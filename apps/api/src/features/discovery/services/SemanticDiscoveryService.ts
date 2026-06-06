interface WorkersAiBinding {
  run(
    model: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

interface VectorizeBinding {
  query(
    vector: number[],
    options?: {
      topK?: number;
      namespace?: string;
      returnMetadata?: boolean | "indexed" | "all" | "none";
    },
  ): Promise<{
    matches?: Array<{
      id: string;
      score?: number;
    }>;
  }>;
  upsert?(vectors: SemanticDishVector[]): Promise<unknown>;
}

interface EmbeddingCache {
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface SemanticDishMatch {
  menuItemId: number;
  score: number;
}

export interface SemanticDishDocument {
  menuItemId: number;
  restaurantId: string;
  text: string;
  catalogType: "menu_item" | "product";
  primaryMarketId?: string | null;
}

interface SemanticDishVector {
  id: string;
  namespace: "dishes";
  values: number[];
  metadata: {
    menuItemId: number;
    restaurantId: string;
    catalogType: "menu_item" | "product";
    primaryMarketId?: string;
  };
}

export interface SemanticDiscoveryConfig {
  ai?: WorkersAiBinding;
  vectorize?: VectorizeBinding;
  embeddingModel?: string;
  embeddingCache?: EmbeddingCache;
  embeddingCacheTtlSeconds?: number;
}

const DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-m3";
const DEFAULT_EMBEDDING_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const DISH_VECTOR_ID_PREFIX = "dish:";

export class SemanticDiscoveryService {
  constructor(private readonly config: SemanticDiscoveryConfig) {}

  async searchDishIds(
    query: string | undefined,
    options: { topK?: number; namespace?: string } = {},
  ): Promise<SemanticDishMatch[]> {
    const trimmed = query?.trim();
    if (!trimmed || !this.config.ai || !this.config.vectorize) return [];

    try {
      const embedding = await this.embed(trimmed);
      if (!embedding.length) return [];

      const matches = await this.config.vectorize.query(embedding, {
        topK: options.topK ?? 50,
        namespace: options.namespace ?? "dishes",
        returnMetadata: "indexed",
      });

      return (matches.matches ?? [])
        .map((match) => this.toDishMatch(match.id, match.score))
        .filter((match): match is SemanticDishMatch => match !== null);
    } catch (error) {
      console.warn("semanticDiscovery.search.failed", { error });
      return [];
    }
  }

  async upsertDishes(
    documents: SemanticDishDocument[],
  ): Promise<{ upserted: number }> {
    const candidates = documents.filter((document) => document.text.trim());
    if (
      candidates.length === 0 ||
      !this.config.ai ||
      !this.config.vectorize?.upsert
    ) {
      return { upserted: 0 };
    }

    try {
      const embeddings = await this.embedBatch(
        candidates.map((document) => document.text),
      );
      const vectors = candidates
        .map((document, index) =>
          this.toDishVector(document, embeddings[index]),
        )
        .filter((vector): vector is SemanticDishVector => vector !== null);

      if (vectors.length === 0) return { upserted: 0 };

      await this.config.vectorize.upsert(vectors);
      return { upserted: vectors.length };
    } catch (error) {
      console.warn("semanticDiscovery.upsert.failed", { error });
      return { upserted: 0 };
    }
  }

  private async embed(query: string): Promise<number[]> {
    const normalized = normalizeEmbeddingQuery(query);
    if (!normalized) return [];

    const model = this.config.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    const cacheKey = await buildEmbeddingCacheKey(model, normalized);
    const cached = await this.config.embeddingCache
      ?.get<number[]>(cacheKey, "json")
      .catch(() => null);

    if (isEmbedding(cached)) return cached;

    const embeddings = await this.embedBatch([normalized]);
    const embedding = embeddings[0] ?? [];
    if (embedding.length) {
      await this.config.embeddingCache
        ?.put(cacheKey, JSON.stringify(embedding), {
          expirationTtl:
            this.config.embeddingCacheTtlSeconds ??
            DEFAULT_EMBEDDING_CACHE_TTL_SECONDS,
        })
        .catch(() => undefined);
    }
    return embedding;
  }

  private async embedBatch(text: string[]): Promise<number[][]> {
    const response = await this.config.ai!.run(
      this.config.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
      { text: text.length === 1 ? text[0] : text },
    );
    const data = response.data;
    if (!Array.isArray(data)) return [];

    return data.map((embedding) =>
      Array.isArray(embedding)
        ? embedding.filter(
            (value): value is number => typeof value === "number",
          )
        : [],
    );
  }

  private toDishMatch(id: string, score: number | undefined) {
    if (!id.startsWith(DISH_VECTOR_ID_PREFIX)) return null;

    const menuItemId = Number(id.slice(DISH_VECTOR_ID_PREFIX.length));
    if (!Number.isInteger(menuItemId) || menuItemId <= 0) return null;

    return { menuItemId, score: score ?? 0 };
  }

  private toDishVector(
    document: SemanticDishDocument,
    embedding: number[] | undefined,
  ): SemanticDishVector | null {
    if (!embedding?.length) return null;

    return {
      id: `${DISH_VECTOR_ID_PREFIX}${document.menuItemId}`,
      namespace: "dishes",
      values: embedding,
      metadata: {
        menuItemId: document.menuItemId,
        restaurantId: document.restaurantId,
        catalogType: document.catalogType,
        ...(document.primaryMarketId
          ? { primaryMarketId: document.primaryMarketId }
          : {}),
      },
    };
  }
}

function normalizeEmbeddingQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function buildEmbeddingCacheKey(
  model: string,
  normalizedQuery: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${model}\0${normalizedQuery}`),
  );
  return `semantic:embedding:${toHex(digest)}`;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number")
  );
}
