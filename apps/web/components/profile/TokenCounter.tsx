'use client';

import { useAiTokens } from '@/queries/use-ai-tokens';

export function TokenCounter() {
  const { data, isLoading } = useAiTokens();

  if (isLoading || !data) return null;

  const remaining = data.daily_tokens_limit - data.daily_tokens_used;
  const isLow = remaining <= 3;
  const isExhausted = remaining <= 0;

  if (data.is_premium) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${
        isExhausted
          ? 'bg-red-50 text-red-600'
          : isLow
          ? 'bg-amber-50 text-amber-600'
          : 'bg-indigo-50 text-indigo-600'
      }`}
      title={`${remaining} of ${data.daily_tokens_limit} AI queries remaining today`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        isExhausted ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-indigo-500'
      }`} />
      {remaining}/{data.daily_tokens_limit}
    </div>
  );
}
