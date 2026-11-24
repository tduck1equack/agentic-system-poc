import { Database } from '../../shared/infrastructure/prisma';
import { ConversationRepository } from '../application/ports';
import { Conversation, ExecutionEvent, Message } from '../domain/conversation';
export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database) {}
  list(userId: string) { return this.db.conversation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  async find(id: string) { const row = await this.db.conversation.findUnique({ where: { id } }); return row ? new Conversation(row) : null; }
  async save(conversation: Conversation) { await this.db.conversation.create({ data: conversation.snapshot() }); }
  async messages(conversationId: string): Promise<Message[]> {
    return (await this.db.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } })).map(row => ({ ...row, role: row.role as Message['role'] }));
  }
  events(conversationId: string) { return this.db.executionEvent.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } }); }
  async appendMessage(data: Message) { await this.db.message.create({ data }); }
  async appendEvent(data: ExecutionEvent) { await this.db.executionEvent.create({ data }); }
}
