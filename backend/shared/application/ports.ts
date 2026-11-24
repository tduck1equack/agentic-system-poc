export interface IdGenerator { next(): string }
export interface Clock { now(): Date }
export interface CredentialVault { encrypt(value: string): string; decrypt(value: string): string }
export type JsonObject = Record<string, unknown>;
export interface ToolDefinition { name: string; description?: string; inputSchema: JsonObject }
export interface ToolGateway {
  discover(endpoint: string, token: string): Promise<ToolDefinition[]>;
  validateSchema(schema: JsonObject): void;
  validateArguments(schema: JsonObject, args: unknown): args is JsonObject;
  call(endpoint: string, token: string, tool: string, args: JsonObject): Promise<unknown>;
}
