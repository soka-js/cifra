import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '../db';
import { dataSources, partnerApiKeys, partners, users } from '../db/schema';
import { sha256 } from '../crypto';
import { allow } from '../rate-limit';

export type Partner = typeof partners.$inferSelect;

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Valida `Authorization: Bearer cfk_...` contra las llaves guardadas (solo su hash). */
export async function authenticatePartner(req: Request): Promise<Partner | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(cfk_[A-Za-z0-9_-]{20,})$/);
  if (!m) return apiError(401, 'no_autorizado', 'Falta la llave de API en el encabezado Authorization: Bearer cfk_...');
  const [row] = await db
    .select({ partner: partners })
    .from(partnerApiKeys)
    .innerJoin(partners, eq(partners.id, partnerApiKeys.partnerId))
    .where(and(eq(partnerApiKeys.keyHash, sha256(m[1]!)), isNull(partnerApiKeys.revokedAt)))
    .limit(1);
  if (!row) return apiError(401, 'no_autorizado', 'La llave de API no existe o fue revocada.');
  if (!(await allow(`api:${row.partner.id}`, 600, 60))) return apiError(429, 'demasiadas_peticiones', 'Máximo 600 peticiones por minuto.');
  return row.partner;
}

export const MEMBER_ID = /^[A-Za-z0-9._:-]{1,80}$/;

export async function findMember(partner: Partner, memberId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.partnerId, partner.id), eq(users.partnerMemberId, memberId)))
    .limit(1);
  return user ?? null;
}

/** La fuente "entidad aliada" del asociado: una por entidad. */
export async function partnerSource(partner: Partner, userId: string) {
  const [existing] = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.userId, userId), eq(dataSources.partnerId, partner.id), eq(dataSources.kind, 'entidad_aliada')))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(dataSources)
    .values({ userId, kind: 'entidad_aliada', entityName: partner.name, partnerId: partner.id, scopes: ['saldos', 'movimientos'], status: 'activa' })
    .returning();
  return created!;
}
