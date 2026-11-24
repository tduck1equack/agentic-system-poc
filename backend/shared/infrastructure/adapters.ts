import { randomBytes } from 'node:crypto';
import Ajv from 'ajv';
import { Clock, CredentialVault, IdGenerator, JsonObject, ToolGateway } from '../application/ports';
import { decrypt, encrypt } from './security';
import { discover, withMcp } from './mcp';
export class RandomIds implements IdGenerator { next() { return randomBytes(16).toString('hex'); } }
export class SystemClock implements Clock { now() { return new Date(); } }
export class EncryptedCredentials implements CredentialVault { encrypt = encrypt; decrypt = decrypt; }
export class McpToolGateway implements ToolGateway {
  private readonly ajv = new Ajv({ strict: false });
  discover = discover;
  validateSchema(schema: JsonObject) { this.ajv.compile(schema); }
  validateArguments(schema: JsonObject, args: unknown): args is JsonObject { return !!args && typeof args === 'object' && !Array.isArray(args) && this.ajv.validate(schema, args); }
  call(endpoint: string, token: string, name: string, args: JsonObject) {
    return withMcp(endpoint, token, client => client.callTool({ name, arguments: args }, undefined, { timeout: 15000 }));
  }
}
