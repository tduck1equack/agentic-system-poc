import { DomainError, requireValue } from '../../shared/domain/errors';
export interface Message { id: string; conversationId: string; role: 'user' | 'assistant'; content: string; createdAt: Date }
export interface ExecutionEvent { id: string; conversationId: string; kind: string; detail: string; createdAt: Date }
export interface ConversationState { id: string; userId: string; createdAt: Date }
export class Conversation {
  constructor(private readonly state: ConversationState) {}
  ownedBy(userId: string) { if (this.state.userId !== userId) throw new DomainError('not_found', 'Not found'); return this; }
  snapshot() { return { ...this.state }; }
  acceptPrompt(prompt: string) { requireValue(prompt.trim().length > 0 && prompt.length <= 8000, 'Prompt must contain 1–8000 characters'); }
}
export class TurnBudget {
  private calls = 0;
  constructor(private readonly deadline: number) {}
  assertTime(now: number) { requireValue(now < this.deadline, 'Agent turn timed out'); }
  useTool(now: number) { this.assertTime(now); requireValue(++this.calls <= 10, 'Tool call limit reached'); }
}
