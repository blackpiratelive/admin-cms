export type ProviderStatus = "connected" | "disconnected" | "syncing" | "error" | "disabled";

export type SyncMode = "incremental" | "full" | "batch";

export interface SyncOptions {
  mode?: SyncMode;
  batchPage?: number;
  batchSize?: number;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ConfigValidationResult {
  valid: boolean;
  error?: string;
}

export interface ConfigField {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
  description?: string;
}

export interface ISyncProvider {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  getConfigFields(): ConfigField[];
  connect(config: Record<string, any>): Promise<boolean>;
  disconnect(): Promise<boolean>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  getStatus(): Promise<ProviderStatus>;
  getStatistics(): Promise<Record<string, number | string>>;
  validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult>;
  testConnection(config: Record<string, any>): Promise<boolean>;
  cancelSync(): Promise<boolean>;
}
