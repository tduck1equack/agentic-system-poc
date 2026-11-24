import 'dotenv/config';
import { Database } from '../backend/shared/infrastructure/prisma';
const db = new Database();
import { hash } from 'bcryptjs';
async function main() {
 for(const [email,role] of [['developer@demo.local','developer'],['alice@demo.local','user'],['bob@demo.local','user']]) {
  await db.user.upsert({where:{email},update:{},create:{email,role,password:await hash(process.env.DEMO_PASSWORD ?? 'demo-password',12)}});
 }
}
main().finally(()=>db.$disconnect());
