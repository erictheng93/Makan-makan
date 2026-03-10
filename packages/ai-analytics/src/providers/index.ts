/**
 * LLM Provider Factory
 * Creates the appropriate provider based on configuration
 */

import { BaseLLMProvider } from "./base";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GoogleProvider } from "./google";
import { DeepSeekProvider } from "./deepseek";
import type { LLMConfig, LLMProvider as LLMProviderType } from "../types";

export { BaseLLMProvider } from "./base";
export { AnthropicProvider } from "./anthropic";
export { OpenAIProvider } from "./openai";
export { GoogleProvider } from "./google";
export { DeepSeekProvider } from "./deepseek";

/**
 * Create an LLM provider instance based on configuration
 */
export function createProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);

    case "openai":
      return new OpenAIProvider(config);

    case "google":
      return new GoogleProvider(config);

    case "deepseek":
      return new DeepSeekProvider(config);

    case "custom":
      if (!config.baseUrl) {
        throw new Error("Custom provider requires baseUrl");
      }
      // For custom providers, use OpenAI-compatible format
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl,
      });

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Test an LLM provider configuration
 */
export async function testProvider(config: LLMConfig): Promise<{
  success: boolean;
  provider: LLMProviderType;
  model?: string;
  latencyMs?: number;
  error?: string;
}> {
  try {
    const provider = createProvider(config);
    const result = await provider.test();

    return {
      ...result,
      provider: config.provider,
      model: provider.getModel(),
    };
  } catch (error) {
    return {
      success: false,
      provider: config.provider,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(providerType: LLMProviderType): string {
  const defaultModels: Record<LLMProviderType, string> = {
    anthropic: "claude-3-5-sonnet-20241022",
    openai: "gpt-4o",
    google: "gemini-1.5-pro",
    deepseek: "deepseek-chat",
    custom: "custom-model",
  };

  return defaultModels[providerType];
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(providerType: LLMProviderType): string[] {
  const models: Record<LLMProviderType, string[]> = {
    anthropic: [
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
    google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    deepseek: ["deepseek-chat", "deepseek-coder"],
    custom: [],
  };

  return models[providerType];
}
