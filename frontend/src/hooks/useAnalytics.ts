// ============================================================
// hooks/useAnalytics.ts — Page view + click tracking
// Fires events to /v1/analytics/event on the backend.
// All calls are fire-and-forget; errors never affect the UI.
// ============================================================

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// ── Session ID — persists for the browser tab lifetime ───────

function getSessionId(): string {
  let id = sessionStorage.getItem('_analytics_sid');
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('_analytics_sid', id);
  }
  return id;
}

// ── Core send helper ──────────────────────────────────────────

async function sendEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/v1/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sessionId: getSessionId(), ...payload }),
    });
  } catch {
    // Silently swallow — analytics must never break the app
  }
}

// ── Public API ────────────────────────────────────────────────

/** Track a button / element click. Call from onClick handlers. */
export function trackClick(element: string, page: string): void {
  sendEvent('click', { element, page });
}

/** Hook: automatically fires a page_view event on every route change. */
export function usePageTracking(): void {
  const location = useLocation();
  const prevPath = useRef<string>('');

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      sendEvent('page_view', {
        path: location.pathname,
        referrer: document.referrer,
      });
    }
  }, [location.pathname]);
}
