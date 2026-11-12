import { and, eq, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { oauthAccounts, users } from '@/lib/db/schema';
import { createSession } from '@/lib/auth/session';
import { CONSENT_VERSION } from '@/lib/format';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('cf_oauth_state')?.value;
  const nextCookie = req.cookies.get('cf_oauth_next')?.value;

  if (!clientId || !clientSecret || !code || !state || state !== savedState) {
    return NextResponse.redirect(new URL('/entrar?oauth=error', req.url));
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin).replace(/\/$/, '');
  const redirectUri = `${site}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error('Profile fetch failed');
    const profile = (await profileRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    // El correo solo cuenta si Google confirma que es de esa persona. Sin eso no se usa para
    // encontrar ni crear cuentas: evita que alguien tome una cuenta ajena con un correo sin verificar.
    const email = profile.email_verified === true ? (profile.email?.toLowerCase().trim() ?? null) : null;

    const [linked] = await db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, profile.sub)))
      .limit(1);

    let userId = linked?.userId ?? null;
    let onboarded = false;

    if (userId) {
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      // Un usuario de demostración no tiene entrada propia: a la demo se llega solo desde /admin.
      if (!u || u.isDemo) throw new Error('Cuenta no disponible');
      onboarded = Boolean(u.onboardedAt);
    } else {
      if (!email) throw new Error('Correo de Google sin verificar');
      const [byEmail] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (byEmail?.isDemo) throw new Error('Cuenta no disponible');
      if (byEmail) {
        userId = byEmail.id;
        onboarded = Boolean(byEmail.onboardedAt);
        await db.insert(oauthAccounts).values({
          userId: byEmail.id,
          provider: 'google',
          providerAccountId: profile.sub,
          email,
        });
      } else {
        const [created] = await db
          .insert(users)
          .values({
            name: profile.name?.slice(0, 80) || 'Persona CIFRA',
            email,
            emailVerifiedAt: new Date(),
            consentVersion: CONSENT_VERSION,
            consentAt: new Date(),
            signupVariant: req.cookies.get('cf_ab')?.value ?? null,
          })
          .returning({ id: users.id });
        userId = created!.id;
        await db.insert(oauthAccounts).values({
          userId,
          provider: 'google',
          providerAccountId: profile.sub,
          email,
        });
      }
    }

    // Google confirmó ese correo: si es el de la cuenta, queda verificado
    // (requisito para /admin cuando está en ADMIN_EMAILS).
    if (email) {
      await db
        .update(users)
        .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
        .where(and(eq(users.id, userId), sql`lower(${users.email}) = ${email}`));
    }

    await createSession(userId);
    const dest =
      nextCookie && nextCookie.startsWith('/') && !nextCookie.startsWith('//')
        ? nextCookie
        : onboarded
          ? '/app'
          : '/app/bienvenida?nuevo=1';
    const res = NextResponse.redirect(new URL(dest, req.url));
    res.cookies.delete('cf_oauth_state');
    res.cookies.delete('cf_oauth_next');
    return res;
  } catch {
    return NextResponse.redirect(new URL('/entrar?oauth=error', req.url));
  }
}
