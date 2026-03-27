import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position`;
  console.log('clients columns:', result.map((r: { column_name: string }) => r.column_name).join(', '));

  const result2 = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'topup_requests' ORDER BY ordinal_position`;
  console.log('topup_requests columns:', result2.map((r: { column_name: string }) => r.column_name).join(', '));
}

main().catch(console.error);
