import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { PluginService } from '../application/plugin.service';
import { CurrentActor } from '../../shared/http/auth';
import type { Actor } from '../../identity/domain/actor';
import { draftInput, tokenInput, validateLogo } from './plugin.dto';
@Controller('api')
export class PluginController {
  constructor(@Inject(PluginService) private readonly plugins: PluginService) {}
  @Get('catalog') catalog() { return this.plugins.catalog(); }
  @Get('developer/plugins') list(@CurrentActor() actor: Actor) { return this.plugins.list(actor); }
  @Post('developer/plugins') @HttpCode(200)
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    const input = draftInput.parse(body); validateLogo(input.logo);
    return this.plugins.create(actor, input);
  }
  @Patch('developer/plugins/:id')
  edit(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    const input = draftInput.parse(body); validateLogo(input.logo);
    return this.plugins.edit(actor, id, input);
  }
  @Post('developer/plugins/:id/validate') @HttpCode(200)
  validate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.plugins.validate(actor, id, tokenInput.parse(body).token); }
  @Post('developer/plugins/:id/publish') @HttpCode(200)
  publish(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.plugins.publish(actor, id, tokenInput.parse(body).token); }
}
