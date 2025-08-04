export interface UsageTrackingClientConfig {
  customerId: string;
}

export interface ModelTrackingDetails {
  ingestionName: string;
}

export interface Tokens {
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
}

export interface UsageTrackingAdapter {
  name?: string;
  trackUsage(customerId: string, modelName: string, tokens: Tokens): Promise<boolean>;
}

export interface PolarAdapterConfig {
  accessToken: string;
  server: "sandbox" | "production";
}
export interface MetronomeAdapterConfig {
  bearerToken: string;
}