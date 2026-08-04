const REFERRAL_STORAGE_KEY = 'vylix_pending_ref_code';

export interface ReferralCodeInfo {
  code: string;
  url: string;
  points_per_referral: number;
  total_earned: number;
}

export interface ReferralInfo {
  referee_name: string | null;
  referee_avatar: string | null;
  created_at: string | null;
  points_earned: number;
}

export function buildReferralLink(code: string): string {
  if (typeof window === 'undefined') return code;
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}

export function captureReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('ref') || '').trim().toUpperCase();
    if (code) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, code);
      params.delete('ref');
      const clean = params.toString();
      const next = `${window.location.pathname}${clean ? `?${clean}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
    }
  } catch {
    // Non-critical
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Non-critical
  }
}

export async function claimPendingReferral(accessToken: string): Promise<void> {
  const code = getPendingReferralCode();
  if (!code) return;
  clearPendingReferralCode();
  try {
    const res = await fetch('/api/user/referrals/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.points_earned) {
      window.dispatchEvent(
        new CustomEvent('vylix:points', { detail: { points: body.points_earned, reason: 'referral_bonus' } })
      );
    }
  } catch {
    // Claim is best-effort; never block the app on it.
  }
}

export async function fetchReferralCode(accessToken: string): Promise<ReferralCodeInfo | null> {
  try {
    const res = await fetch('/api/user/referral-code', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchReferrals(accessToken: string): Promise<ReferralInfo[]> {
  try {
    const res = await fetch('/api/user/referrals', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
