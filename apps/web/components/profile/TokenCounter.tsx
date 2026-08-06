'use client';

import { useAiTokens } from '@/queries/use-ai-tokens';

export function TokenCounter() {
  const { data, isLoading } = useAiTokens();

  if (isLoading || !data) return null;

  const remaining = data.remaining;
  const limit = data.limit;
  const isLow = remaining <= 3;
  const isExhausted = remaining <= 0;

  const title = data.has_paid_pass
    ? `${remaining} of ${limit} AI queries left on ${data.plan_name}`
    : `${remaining} of ${limit} AI queries remaining today`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${
        isExhausted
          ? 'bg-red-50 text-red-600'
          : isLow
          ? 'bg-amber-50 text-amber-600'
          : 'bg-blue-50 text-blue-600'
      }`}
      title={title}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        isExhausted ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-blue-500'
      }`} />
      {remaining}/{limit}
    </div>
  );
}
