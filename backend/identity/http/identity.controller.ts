import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { IdentityService } from '../application/identity.service';
import { CurrentActor, Public } from '../../shared/http/auth';
import type { AuthRequest } from '../../shared/http/auth';
import type { Actor } from '../domain/actor';
@Controller('api')
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}
  @Public() @Post('login') @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = z.object({ email: z.string(), password: z.string().max(200) }).parse(body);
    const session = await this.identity.login(input.email, input.password);
    response.cookie('session', session.id, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 86400000 });
    return { ok: true };
  }
  @Get('me') me(@CurrentActor() actor: Actor) { return { email: actor.email, role: actor.role }; }
  @Post('logout') @HttpCode(200)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.identity.logout(request.sessionId);
    response.clearCookie('session', { httpOnly: true, sameSite: 'strict', path: '/' });
    return { ok: true };
  }
}
