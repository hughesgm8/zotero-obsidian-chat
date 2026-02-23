import type { ZoteroMCPSettings } from "../types";
import type { LLMProvider } from "./llm-provider";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";
import { AnthropicProvider } from "./anthropic";

export function createLLMProvider(settings: ZoteroMCPSettings): LLMProvider {
	switch (settings.llmProvider) {
		case "ollama":
			return new OllamaProvider(
				settings.ollamaBaseUrl,
				settings.ollamaModel
			);
		case "openrouter":
			return new OpenRouterProvider(
				settings.openrouterApiKey,
				settings.openrouterModel
			);
		case "anthropic":
			return new AnthropicProvider(
				settings.anthropicApiKey,
				settings.anthropicModel
			);
		default:
			throw new Error(
				`Unknown LLM provider: ${settings.llmProvider as string}`
			);
	}
}

export type { LLMProvider, LLMMessage, LLMResponse } from "./llm-provider";
