import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase-server';

function buildErrorHtml(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.location.href = '/auth/callback?error=${encodeURIComponent(error)}';
  </script>
</head>
<body>Redirecting...</body>
</html>`;
}

function buildSuccessHtml(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  tokenType: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.location.href = '/auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=${expiresIn}&token_type=${tokenType}';
  </script>
</head>
<body>Redirecting...</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(buildErrorHtml('Google OAuth is not configured'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const returnedState = searchParams.get('state');

  if (error) {
    return new Response(buildErrorHtml(error), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    return new Response(buildErrorHtml('No authorization code received'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('google_oauth_state')?.value;

  cookieStore.delete('google_oauth_state');

  if (!savedState || savedState !== returnedState) {
    return new Response(buildErrorHtml('State mismatch. Please try again.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  let googleTokens: { id_token: string; access_token: string; expires_in: number };
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[google-oauth] Token exchange failed:', errBody);
      return new Response(buildErrorHtml('Failed to exchange authorization code'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    googleTokens = await tokenResponse.json();
  } catch (err) {
    console.error('[google-oauth] Token exchange error:', err);
    return new Response(buildErrorHtml('Token exchange failed'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  let supabaseSession: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error: signInError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: googleTokens.id_token,
      access_token: googleTokens.access_token,
    });

    if (signInError) {
      console.error('[google-oauth] Supabase signInWithIdToken error:', signInError);
      return new Response(buildErrorHtml(signInError.message), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!data.session) {
      return new Response(buildErrorHtml('No session returned from Supabase'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    supabaseSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    };
  } catch (err) {
    console.error('[google-oauth] Supabase sign-in error:', err);
    return new Response(buildErrorHtml('Failed to create session'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(
    buildSuccessHtml(
      supabaseSession.access_token,
      supabaseSession.refresh_token,
      supabaseSession.expires_in,
      supabaseSession.token_type
    ),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
