'use client';

import posthog from 'posthog-js';

const POSTHOG_KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY || '').trim();
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').trim();

let initialized = false;

export function isPostHogConfigured(): boolean {
  return POSTHOG_KEY.length > 0;
}

/**
 * Initialise PostHog once, on the client. No-ops when the key is absent so
 * local development and preview environments keep working.
 *
 * Privacy: autocapture and session recording are disabled, DNT is respected,
 * and only pseudonymous ids plus coarse properties are sent. Never pass
 * emails, names, message contents, or uploaded file names.
 */
export function initPostHog(): void {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    person_profiles: 'identified_only',
    autocapture: false,
    disable_session_recording: true,
    respect_dnt: true,
  });
  initialized = true;
}

export function identifyPostHogUser(
  id: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  try {
    posthog.identify(id, properties);
  } catch {
    // Analytics must never break the UI.
  }
}

export function resetPostHogUser(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    // Analytics must never break the UI.
  }
}

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the UI.
  }
}
