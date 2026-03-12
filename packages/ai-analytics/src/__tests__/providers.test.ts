/**
 * Tests for LLM Provider Factory and Provider implementations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProvider,
  testProvider,
  getDefaultModel,
  getAvailableModels,
} from "../providers";
import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { GoogleProvider } from "../providers/google";
import { DeepSeekProvider } from "../providers/deepseek";
import type { LLMConfig } from "../types";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Provider Factory - createProvider", () => {
  it("creates an OpenAI provider", () => {
    const config: LLMConfig = {
      provider: "openai",
      apiKey: "sk-test-key",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("creates an Anthropic provider", () => {
    const config: LLMConfig = {
      provider: "anthropic",
      apiKey: "sk-ant-test-key",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("creates a Google provider", () => {
    const config: LLMConfig = {
      provider: "google",
      apiKey: "google-test-key",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(GoogleProvider);
  });

  it("creates a DeepSeek provider", () => {
    const config: LLMConfig = {
      provider: "deepseek",
      apiKey: "ds-test-key",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(DeepSeekProvider);
  });

  it("creates an OpenAI-compatible provider for custom type with baseUrl", () => {
    const config: LLMConfig = {
      provider: "custom",
      apiKey: "custom-key",
      baseUrl: "https://my-llm.example.com/v1",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("throws for custom provider without baseUrl", () => {
    const config: LLMConfig = {
      provider: "custom",
      apiKey: "custom-key",
    };
    expect(() => createProvider(config)).toThrow(
      "Custom provider requires baseUrl",
    );
  });

  it("throws for unknown provider", () => {
    const config = {
      provider: "unknown-provider" as any,
      apiKey: "key",
    };
    expect(() => createProvider(config)).toThrow("Unknown provider");
  });
});

describe("Provider Factory - getDefaultModel", () => {
  it("returns correct default model for anthropic", () => {
    expect(getDefaultModel("anthropic")).toBe("claude-3-5-sonnet-20241022");
  });

  it("returns correct default model for openai", () => {
    expect(getDefaultModel("openai")).toBe("gpt-4o");
  });

  it("returns correct default model for google", () => {
    expect(getDefaultModel("google")).toBe("gemini-1.5-pro");
  });

  it("returns correct default model for deepseek", () => {
    expect(getDefaultModel("deepseek")).toBe("deepseek-chat");
  });

  it("returns custom-model for custom provider", () => {
    expect(getDefaultModel("custom")).toBe("custom-model");
  });
});

describe("Provider Factory - getAvailableModels", () => {
  it("returns multiple models for openai", () => {
    const models = getAvailableModels("openai");
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("gpt-4o");
    expect(models).toContain("gpt-4o-mini");
  });

  it("returns multiple models for anthropic", () => {
    const models = getAvailableModels("anthropic");
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("claude-3-5-sonnet-20241022");
  });

  it("returns multiple models for google", () => {
    const models = getAvailableModels("google");
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("gemini-1.5-pro");
  });

  it("returns multiple models for deepseek", () => {
    const models = getAvailableModels("deepseek");
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("deepseek-chat");
  });

  it("returns empty array for custom provider", () => {
    expect(getAvailableModels("custom")).toEqual([]);
  });
});

describe("Provider Factory - testProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns success when provider test passes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 1,
          total_tokens: 6,
        },
      }),
    });

    const result = await testProvider({
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o");
    expect(result.latencyMs).toBeDefined();
  });

  it("returns error when provider creation fails", async () => {
    const result = await testProvider({
      provider: "custom",
      apiKey: "key",
      // No baseUrl - will throw
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("custom");
    expect(result.error).toContain("Custom provider requires baseUrl");
  });

  it("returns error when provider test call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await testProvider({
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("openai");
    expect(result.error).toBeDefined();
  });
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new OpenAIProvider({
      provider: "openai",
      apiKey: "sk-test-key",
    });
  });

  it("uses default model gpt-4o when none specified", () => {
    expect(provider.getModel()).toBe("gpt-4o");
  });

  it("uses custom model when specified", () => {
    const customProvider = new OpenAIProvider({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-3.5-turbo",
    });
    expect(customProvider.getModel()).toBe("gpt-3.5-turbo");
  });

  it("sends correct request format for chat", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: Date.now(),
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    });

    const response = await provider.chat({
      prompt: "Hello",
      systemPrompt: "You are helpful",
    });

    expect(response.content).toBe("Hello!");
    expect(response.usage?.totalTokens).toBe(15);
    expect(response.finishReason).toBe("stop");

    // Verify the fetch call
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(options.body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });

  it("includes json response format when requested", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: '{"key":"value"}' }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }),
    });

    await provider.chat({
      prompt: "Give me JSON",
      responseFormat: "json",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Unauthorized",
      json: async () => ({
        error: { message: "Invalid API key" },
      }),
    });

    await expect(provider.chat({ prompt: "test" })).rejects.toThrow(
      "OpenAI provider error",
    );
  });

  it("throws on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(provider.chat({ prompt: "test" })).rejects.toThrow(
      "OpenAI provider error",
    );
  });

  it("test method returns success on valid response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      }),
    });

    const result = await provider.test();
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("test method returns error on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await provider.test();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new AnthropicProvider({
      provider: "anthropic",
      apiKey: "sk-ant-test",
    });
  });

  it("uses default model claude-3-5-sonnet", () => {
    expect(provider.getModel()).toBe("claude-3-5-sonnet-20241022");
  });

  it("sends correct Anthropic API request format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "msg-test",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello from Claude!" }],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 8 },
      }),
    });

    const response = await provider.chat({
      prompt: "Hello",
      systemPrompt: "Be helpful",
    });

    expect(response.content).toBe("Hello from Claude!");
    expect(response.usage?.promptTokens).toBe(10);
    expect(response.usage?.completionTokens).toBe(8);
    expect(response.usage?.totalTokens).toBe(18);

    // Verify headers include anthropic-specific fields
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.headers["x-api-key"]).toBe("sk-ant-test");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(options.body);
    expect(body.system).toBe("Be helpful");
    expect(body.messages[0].role).toBe("user");
  });

  it("handles API errors properly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({
        error: { message: "Invalid request" },
      }),
    });

    await expect(provider.chat({ prompt: "test" })).rejects.toThrow(
      "Anthropic provider error",
    );
  });
});

describe("GoogleProvider", () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new GoogleProvider({
      provider: "google",
      apiKey: "google-test-key",
    });
  });

  it("uses default model gemini-1.5-pro", () => {
    expect(provider.getModel()).toBe("gemini-1.5-pro");
  });

  it("sends correct Gemini API request format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Hello from Gemini!" }],
              role: "model",
            },
            finishReason: "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 8,
          totalTokenCount: 13,
        },
      }),
    });

    const response = await provider.chat({
      prompt: "Hello",
      systemPrompt: "Be concise",
    });

    expect(response.content).toBe("Hello from Gemini!");
    expect(response.usage?.totalTokens).toBe(13);

    // Verify URL includes API key
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("key=google-test-key");
    expect(url).toContain("gemini-1.5-pro");
  });

  it("throws when no candidates returned", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    await expect(provider.chat({ prompt: "test" })).rejects.toThrow(
      "No candidates in Gemini response",
    );
  });
});

describe("DeepSeekProvider", () => {
  let provider: DeepSeekProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new DeepSeekProvider({
      provider: "deepseek",
      apiKey: "ds-test-key",
    });
  });

  it("uses default model deepseek-chat", () => {
    expect(provider.getModel()).toBe("deepseek-chat");
  });

  it("sends correct DeepSeek API request (OpenAI-compatible format)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "ds-test",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "DeepSeek response" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 5,
          total_tokens: 13,
        },
      }),
    });

    const response = await provider.chat({
      prompt: "Hello",
    });

    expect(response.content).toBe("DeepSeek response");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(options.headers["Authorization"]).toBe("Bearer ds-test-key");

    const body = JSON.parse(options.body);
    expect(body.stream).toBe(false);
  });
});
