import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../shared/infrastructure/infrastructure.module';
import { Database } from '../shared/infrastructure/prisma';
import { RandomIds, SystemClock } from '../shared/infrastructure/adapters';
import { InstallationsModule } from '../installations/installations.module';
import { InstallationService } from '../installations/application/installation.service';
import { ConversationService } from './application/conversation.service';
import { PrismaConversationRepository } from './infrastructure/prisma-conversation.repository';
import { OpenAiLanguageModel } from './infrastructure/openai-language-model';
import { ConversationController } from './http/conversation.controller';
@Module({
  imports: [InfrastructureModule, InstallationsModule], controllers: [ConversationController],
  providers: [{ provide: ConversationService, inject: [Database, InstallationService, RandomIds, SystemClock], useFactory: (db: Database, plugins: InstallationService, ids: RandomIds, clock: SystemClock) => new ConversationService(new PrismaConversationRepository(db), plugins, new OpenAiLanguageModel(), ids, clock) }],
})
export class ConversationsModule {}
