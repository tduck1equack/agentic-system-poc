import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Actor } from '../../identity/domain/actor';
import { IdentityService } from '../../identity/application/identity.service';
import { DomainError } from '../domain/errors';
export type AuthRequest = Request & { actor: Actor; sessionId: string };
const PUBLIC = 'public-route';
export const Public = () => SetMetadata(PUBLIC, true);
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => context.switchToHttp().getRequest<AuthRequest>().actor);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService, @Inject(Reflector) private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const origin = request.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin && origin !== `${request.protocol}://${request.get('host')}`) throw new DomainError('forbidden', 'Origin rejected');
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()])) return true;
    request.sessionId = request.headers.cookie?.match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1] ?? '';
    request.actor = await this.identity.authenticate(request.sessionId);
    return true;
  }
}
