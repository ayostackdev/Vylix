import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured' },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();

  const state = crypto.randomBytes(32).toString('hex');
  const isHttps = request.nextUrl.protocol === 'https:';

  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  });

  const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const origin = new URL(rawOrigin).origin;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(googleUrl);
}
