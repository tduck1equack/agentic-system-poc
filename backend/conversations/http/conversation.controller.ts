import { Body, Controller, Get, HttpCode, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentActor } from '../../shared/http/auth';
import type { Actor } from '../../identity/domain/actor';
import { ConversationService } from '../application/conversation.service';
@Controller('api/conversations')
export class ConversationController {
  constructor(@Inject(ConversationService) private readonly conversations: ConversationService) {}
  @Get() list(@CurrentActor() actor: Actor) { return this.conversations.list(actor.id); }
  @Post('provider/verify') @HttpCode(200) verifyProvider() { return this.conversations.verifyProvider(); }
  @Post() @HttpCode(200) create(@CurrentActor() actor: Actor) { return this.conversations.create(actor.id); }
  @Get(':id') get(@CurrentActor() actor: Actor, @Param('id') id: string) { return this.conversations.get(actor.id, id); }
  @Post(':id/messages')
  async send(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown, @Res() response: Response) {
    const input = z.object({ prompt: z.string(), approved: z.array(z.string()).max(50).default([]) }).parse(body);
    const run = await this.conversations.prepare(actor.id, id, input.prompt, input.approved);
    response.status(200).set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
    const emit = (event: unknown) => { if (!response.destroyed) response.write(JSON.stringify(event) + '\n'); };
    try { await run(emit); }
    catch { emit({ type: 'error', text: 'Agent failed or timed out. Check server configuration and plugin connection.' }); }
    finally { response.end(); }
  }
}
