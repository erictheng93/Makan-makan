/**
 * OpenAI Provider
 * https://platform.openai.com/docs/api-reference/chat
 */

import { BaseLLMProvider } from './base';
import type { LLMRequest, LLMResponse } from '../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'text' | 'json_object' };
}

interface OpenAIResponse {
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

export class OpenAIProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://api.openai.com/v1';

  protected getDefaultModel(): string {
    return 'gpt-4o';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const messages: OpenAIMessage[] = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const openaiRequest: OpenAIRequest = {
        model: this.getModel(),
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens || 4096,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
      };

      if (request.responseFormat === 'json') {
        openaiRequest.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(openaiRequest),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as OpenAIResponse;
      const latencyMs = Date.now() - startTime;

      return {
        content: data.choices[0]?.message?.content || '',
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
      throw new Error(`OpenAI provider error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async test(): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
