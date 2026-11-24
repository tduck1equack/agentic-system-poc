import { Conversation, ConversationState, ExecutionEvent, Message } from '../domain/conversation';
import { ToolDefinition } from '../../shared/application/ports';
export interface ConversationRepository {
  list(userId: string): Promise<ConversationState[]>;
  find(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  messages(id: string): Promise<Message[]>;
  events(id: string): Promise<ExecutionEvent[]>;
  appendMessage(message: Message): Promise<void>;
  appendEvent(event: ExecutionEvent): Promise<void>;
}
export interface ModelCall { id: string; name: string; arguments: string }
export interface ModelSession {
  complete(tools: ToolDefinition[], signal: AbortSignal): Promise<{ text: string; calls: ModelCall[] }>;
  acceptResult(callId: string, output: string): void;
}
export interface LanguageModel {
  session(instructions: string, messages: { role: 'user' | 'assistant'; content: string }[]): ModelSession;
  verify(signal: AbortSignal): Promise<{ status: 'connected'; model: string }>;
}
export type ChatEvent = { type: 'activity'; kind: string; detail: string } | { type: 'text' | 'error'; text: string } | { type: 'approval'; tool: string; name: string };
