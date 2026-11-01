// Crea una entidad aliada y su llave de API. La llave se muestra una sola vez.
// Uso: DATABASE_URL=... npm run partner:create -- "Cooperativa Ejemplo"
import { createHash, randomBytes } from 'node:crypto';
import postgres from 'postgres';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {
  console.error('Uso: npm run partner:create -- "Nombre de la entidad"');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL.');
  process.exit(1);
}
const slug = name
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const key = `cfk_${randomBytes(24).toString('base64url')}`;
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  const [partner] = await sql`insert into partners (name, slug) values (${name}, ${slug})
    on conflict (slug) do update set name = excluded.name returning id, slug`;
  await sql`insert into partner_api_keys (partner_id, prefix, key_hash)
    values (${partner.id}, ${key.slice(0, 10)}, ${createHash('sha256').update(key).digest('hex')})`;
  console.log(`Entidad: ${name} (${partner.slug})`);
  console.log(`Llave de API (guárdala ahora, no se vuelve a mostrar):\n${key}`);
} finally {
  await sql.end();
}
