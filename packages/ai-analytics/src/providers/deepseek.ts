/**
 * DeepSeek Provider
 * https://api-docs.deepseek.com/
 * Compatible with OpenAI API format
 */

import { BaseLLMProvider } from "./base";
import type { LLMRequest, LLMResponse } from "../types";

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekProvider extends BaseLLMProvider {
  private readonly baseUrl = "https://api.deepseek.com/v1";

  protected getDefaultModel(): string {
    return "deepseek-chat";
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const messages: DeepSeekMessage[] = [];

      if (request.systemPrompt) {
        messages.push({
          role: "system",
          content: request.systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: request.prompt,
      });

      const deepseekRequest: DeepSeekRequest = {
        model: this.getModel(),
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens || 4096,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        stream: false,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(deepseekRequest),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: { message?: string };
        };
        throw new Error(
          `DeepSeek API error: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as DeepSeekResponse;
      const latencyMs = Date.now() - startTime;

      return {
        content: data.choices[0]?.message?.content || "",
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        finishReason: data.choices[0]?.finish_reason,
        metadata: {
          model: data.model,
          latencyMs,
        },
      };
    } catch (error) {
      throw new Error(
        `DeepSeek provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async test(): Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.chat({
        prompt: 'Hello! Please respond with "OK".',
        maxTokens: 10,
        temperature: 0,
      });

      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        latencyMs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
