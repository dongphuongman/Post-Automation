import { sql } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';

export async function POST() {
  try {
    await sql`DELETE FROM articles`;
    await sql`DELETE FROM sources`;
    return ok({ message: 'Database cleared' });
  } catch (error) {
    return fail(String(error));
  }
}
