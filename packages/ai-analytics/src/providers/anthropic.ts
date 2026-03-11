/**
 * Anthropic Claude Provider
 * https://docs.anthropic.com/claude/reference/messages_post
 */

import { BaseLLMProvider } from "./base";
import type { LLMRequest, LLMResponse } from "../types";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider extends BaseLLMProvider {
  private readonly baseUrl = "https://api.anthropic.com/v1";
  private readonly apiVersion = "2023-06-01";

  protected getDefaultModel(): string {
    return "claude-3-5-sonnet-20241022";
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const anthropicRequest: AnthropicRequest = {
        model: this.getModel(),
        max_tokens: request.maxTokens || this.config.maxTokens || 4096,
        messages: [
          {
            role: "user",
            content: request.prompt,
          },
        ],
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      };

      if (request.systemPrompt) {
        anthropicRequest.system = request.systemPrompt;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify(anthropicRequest),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error?: { message?: string };
        };
        throw new Error(
          `Anthropic API error: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as AnthropicResponse;
      const latencyMs = Date.now() - startTime;

      return {
        content: data.content[0]?.text || "",
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        finishReason: data.stop_reason,
        metadata: {
          model: data.model,
          latencyMs,
        },
      };
    } catch (error) {
      throw new Error(
        `Anthropic provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
