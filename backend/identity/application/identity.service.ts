import { Account, Actor, Session, sessionIsActive } from '../domain/actor';
import { DomainError } from '../../shared/domain/errors';
import { Clock, IdGenerator } from '../../shared/application/ports';
export interface IdentityRepository {
  accountByEmail(email: string): Promise<Account | null>;
  accountById(id: string): Promise<Account | null>;
  session(id: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
export interface PasswordVerifier { verify(password: string, hash: string): Promise<boolean> }
export class IdentityService {
  constructor(private readonly repository: IdentityRepository, private readonly passwords: PasswordVerifier, private readonly ids: IdGenerator, private readonly clock: Clock) {}
  async login(email: string, password: string) {
    const account = await this.repository.accountByEmail(email);
    if (!account || !await this.passwords.verify(password, account.password)) throw new DomainError('unauthorized', 'Invalid login');
    const session = { id: this.ids.next(), userId: account.id, expires: new Date(this.clock.now().getTime() + 86400000) };
    await this.repository.saveSession(session);
    return session;
  }
  async authenticate(sessionId: string): Promise<Actor> {
    const session = await this.repository.session(sessionId);
    if (!session || !sessionIsActive(session, this.clock.now())) throw new DomainError('unauthorized', 'Please sign in');
    const account = await this.repository.accountById(session.userId);
    if (!account) throw new DomainError('unauthorized', 'Please sign in');
    return { id: account.id, email: account.email, role: account.role };
  }
  logout(sessionId: string) { return this.repository.deleteSession(sessionId); }
}
