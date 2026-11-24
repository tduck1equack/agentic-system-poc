import { DomainError } from '../../shared/domain/errors';
export interface Actor { id: string; email: string; role: string }
export function requireDeveloper(actor: Actor) {
  if (actor.role !== 'developer') throw new DomainError('forbidden', 'Developer access required');
}
export interface Account extends Actor { password: string }
export interface Session { id: string; userId: string; expires: Date }
export function sessionIsActive(session: Session, now: Date): boolean { return session.expires > now; }
