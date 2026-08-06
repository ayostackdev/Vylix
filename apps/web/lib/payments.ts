'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export async function initializePaystackPayment(
  email: string,
  plan: string,
): Promise<{ authorization_url: string; reference: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch('/api/payments/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, plan }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.authorization_url) {
    throw new Error(data.detail || 'Payment initialization failed. Please try again.');
  }
  return data as { authorization_url: string; reference: string };
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}
