import { Database } from '../../shared/infrastructure/prisma';
import { IdentityRepository } from '../application/identity.service';
import { Session } from '../domain/actor';
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Database) {}
  accountByEmail(email: string) { return this.db.user.findUnique({ where: { email } }); }
  accountById(id: string) { return this.db.user.findUnique({ where: { id } }); }
  session(id: string) { return this.db.session.findUnique({ where: { id } }); }
  async saveSession(data: Session) { await this.db.session.create({ data }); }
  async deleteSession(id: string) { await this.db.session.deleteMany({ where: { id } }); }
}
