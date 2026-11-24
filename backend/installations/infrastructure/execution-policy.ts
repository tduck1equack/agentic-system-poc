import { OutputSanitizer, ToolApprovalPolicy } from '../application/installation.service';
import { redact } from '../../shared/infrastructure/security';
export class SecretRedaction implements OutputSanitizer { create(secrets: string[]) { return (text: string) => redact(text, secrets); } }
export class ReferenceToolApproval implements ToolApprovalPolicy {
  trusted(endpoint: string, toolName: string) {
    return process.env.ALLOW_LOCAL_MCP === 'true' && endpoint === process.env.REFERENCE_MCP_URL && ['search_articles', 'get_article'].includes(toolName);
  }
}
