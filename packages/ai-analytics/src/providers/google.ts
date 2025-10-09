/**
 * Google Gemini Provider
 * https://ai.google.dev/docs/gemini_api_overview
 */

import { BaseLLMProvider } from './base';
import type { LLMRequest, LLMResponse } from '../types';

interface GeminiContent {
  parts: Array<{ text: string }>;
  role?: string;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GoogleProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  protected getDefaultModel(): string {
    return 'gemini-1.5-pro';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const geminiRequest: GeminiRequest = {
        contents: [
          {
            parts: [{ text: request.prompt }],
            role: 'user',
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens || this.config.maxTokens || 4096,
        },
      };

      if (request.systemPrompt) {
        geminiRequest.systemInstruction = {
          parts: [{ text: request.systemPrompt }],
        };
      }

      const model = this.getModel();
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequest),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        throw new Error(`Google API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as GeminiResponse;
      const latencyMs = Date.now() - startTime;

      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidates in Gemini response');
      }

      return {
        content: candidate.content.parts[0]?.text || '',
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined,
        finishReason: candidate.finishReason,
        metadata: {
          model,
          latencyMs,
        },
      };
    } catch (error) {
      throw new Error(`Google provider error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
