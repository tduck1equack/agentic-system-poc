import { randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import { IdGenerator } from '../../shared/application/ports';
import { PasswordVerifier } from '../application/identity.service';
export class SessionIds implements IdGenerator { next() { return randomBytes(32).toString('hex'); } }
export class BcryptPasswords implements PasswordVerifier { verify(password: string, hash: string) { return compare(password, hash); } }
