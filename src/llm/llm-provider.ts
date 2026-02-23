export interface LLMMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface LLMResponse {
	content: string;
}

export interface LLMProvider {
	chat(messages: LLMMessage[]): Promise<LLMResponse>;
	testConnection(): Promise<boolean>;
	getModelName(): string;
}
