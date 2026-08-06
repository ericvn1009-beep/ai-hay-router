export interface ModelEndpoint {
  id: string;
  base_url: string;
  credential_ref: string;
  priority: number;
}

export interface ModelRecord {
  id: string;
  provider: string;
  upstream_id: string;
  context_length: number;
  supports_tools: boolean;
  supports_streaming: boolean;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  active: boolean;
  endpoints: ModelEndpoint[];
  fallback_models: string[];
}

export interface RegistryFile {
  models: ModelRecord[];
}
