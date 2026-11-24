import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentActor } from '../../shared/http/auth';
import type { Actor } from '../../identity/domain/actor';
import { InstallationService } from '../application/installation.service';
@Controller('api/installations')
export class InstallationController {
  constructor(@Inject(InstallationService) private readonly installations: InstallationService) {}
  @Get() list(@CurrentActor() actor: Actor) { return this.installations.list(actor.id); }
  @Post() @HttpCode(200)
  install(@CurrentActor() actor: Actor, @Body() body: unknown) {
    const input = z.object({ versionId: z.string().min(1), token: z.string().max(4096).default('') }).parse(body);
    return this.installations.install(actor.id, input.versionId, input.token);
  }
  @Patch(':id') update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    const patch = z.object({ token: z.string().max(4096).optional(), enabled: z.boolean().optional() }).parse(body);
    return this.installations.update(actor.id, id, patch);
  }
  @Post(':id/verify') @HttpCode(200)
  verify(@CurrentActor() actor: Actor, @Param('id') id: string) { return this.installations.verify(actor.id, id); }
  @Delete(':id') uninstall(@CurrentActor() actor: Actor, @Param('id') id: string) { return this.installations.uninstall(actor.id, id); }
}
