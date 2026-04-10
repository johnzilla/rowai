'use client';

import { useState, useCallback } from 'react';
import { useSessionStore } from '@/lib/session/session-store';
import { audioQueue } from '@/lib/coaching/audio-queue';

type ButtonIntent = 'too_hard' | 'push_me' | 'im_good';

interface TapButton {
  label: string;
  intent: ButtonIntent;
}

// D-12: Fixed buttons — always the same 3 options, not context-adaptive
const BUTTONS: TapButton[] = [
  { label: 'Too Hard', intent: 'too_hard' },
  { label: 'Push Me', intent: 'push_me' },
  { label: "I'm Good", intent: 'im_good' },
];

const DEBOUNCE_MS = 300;

/**
 * MidSessionControls — bottom bar with 3 fixed tap buttons (D-09, D-10, D-12).
 *
 * - Always renders the same 3 options (D-12)
 * - 48px+ touch targets, full-width divided into 3 columns, thumb-reachable
 * - Each tap: POSTs to /api/coach with intent, streams SSE text, pipes through /api/tts
 * - 300ms debounce per button to prevent double-tap (T-02-13)
 * - MID-01: triggers LLM coaching response via /api/coach
 */
export function MidSessionControls() {
  // Per-button disabled state for debounce (T-02-13)
  const [disabledButtons, setDisabledButtons] = useState<Set<ButtonIntent>>(new Set());

  const handleTap = useCallback(async (intent: ButtonIntent) => {
    if (disabledButtons.has(intent)) return;

    // Disable button for DEBOUNCE_MS to prevent double-tap
    setDisabledButtons((prev) => new Set([...prev, intent]));
    setTimeout(() => {
      setDisabledButtons((prev) => {
        const next = new Set(prev);
        next.delete(intent);
        return next;
      });
    }, DEBOUNCE_MS);

    // Build session context from current store state
    const sessionState = useSessionStore.getState();
    const reading = sessionState.latestReading;
    const sessionStartedAt = sessionState.sessionStartedAt;

    const elapsedMin = sessionStartedAt ? (Date.now() - sessionStartedAt) / 60000 : 0;

    const sessionContext = {
      rate: reading?.strokeRate ?? null,
      splitMs: reading?.splitMs ?? null,
      watts: reading?.watts ?? null,
      elapsedMin: Math.round(elapsedMin * 10) / 10,
      distanceM: reading?.distanceMeters ?? null,
    };

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, sessionContext }),
      });

      if (!res.ok || !res.body) return;

      // Stream SSE text response
      const fullText = await streamSseText(res);
      if (fullText) {
        await playTextViaTts(fullText);
      }
    } catch {
      // Network errors are non-fatal during a session — coach response is best-effort
    }
  }, [disabledButtons]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 pb-safe-bottom">
      <div className="flex">
        {BUTTONS.map((btn) => {
          const isDisabled = disabledButtons.has(btn.intent);
          return (
            <button
              key={btn.intent}
              onClick={() => void handleTap(btn.intent)}
              disabled={isDisabled}
              className={[
                'flex-1 min-h-[56px] py-4 text-sm font-semibold',
                'border-r border-gray-800 last:border-r-0',
                'transition-colors duration-150',
                isDisabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-white active:bg-gray-800',
              ].join(' ')}
              aria-label={btn.label}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers (duplicated from CheckinScreen for component isolation)
// ---------------------------------------------------------------------------

async function streamSseText(res: Response): Promise<string> {
  if (!res.body) return '';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload) as { type?: string; text?: string };
        if (parsed.type === 'text_delta' && parsed.text) {
          fullText += parsed.text;
        }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }

  return fullText;
}

async function playTextViaTts(text: string): Promise<void> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload) as { type?: string; data?: string };
          if (parsed.type === 'chunk' && parsed.data) {
            await audioQueue.playChunk(parsed.data, 24000);
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } catch {
    // TTS errors are non-fatal
  }
}
