'use client';

import { SseParser } from '@pms/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_URL, refreshSession, tokenStore } from '@/lib/api';

/** Which cached screens each live event makes stale. Events carry ids only; screens refetch through the normal API. */
const STALE: Record<string, string[]> = {
  'room.changed': ['rooms', 'calendar', 'availability', 'front-desk', 'housekeeping'],
  'reservation.changed': ['reservations', 'reservation', 'calendar', 'availability', 'front-desk', 'rooms'],
  'housekeeping.changed': ['housekeeping', 'rooms'],
  'maintenance.changed': ['maintenance', 'rooms'],
  'folio.changed': ['folio', 'front-desk', 'reservation'],
};

/**
 * Keeps screens live: a front-desk check-out shows up as a dirty room and a housekeeping task on other
 * screens within a moment, with no refresh. Uses fetch (not EventSource) so it can send the access token.
 * Reconnects with backoff; if the stream is unavailable the screens still refresh on their timers.
 */
export function useRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let pending = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      const keys = pending;
      pending = new Set();
      keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
    };
    const markStale = (type: string) => {
      (STALE[type] ?? []).forEach((k) => pending.add(k));
      if (!flushTimer) flushTimer = setTimeout(flush, 250); // batch bursts of events into one refetch
    };

    async function run() {
      let delay = 1000;
      while (!stopped) {
        controller = new AbortController();
        try {
          const response = await fetch(`${API_URL}/realtime/stream`, {
            headers: { Accept: 'text/event-stream', ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}) },
            credentials: 'include',
            signal: controller.signal,
          });
          if (response.status === 401) {
            await refreshSession();
          } else if (response.ok && response.body) {
            delay = 1000;
            const parser = new SseParser();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              for (const message of parser.push(decoder.decode(value, { stream: true }))) markStale(message.event);
            }
          }
        } catch {
          if (stopped) return;
        }
        if (stopped) return;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 15_000);
      }
    }
    void run();

    return () => {
      stopped = true;
      controller?.abort();
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [queryClient]);
}
