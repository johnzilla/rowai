'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TapInputRow } from './TapInputRow';
import { audioQueue } from '@/lib/coaching/audio-queue';
import { useCoachingStore } from '@/lib/coaching/coaching-store';
import type { EnergyLevel, TimeAvailable } from '@/lib/coaching/coaching-types';

const ENERGY_OPTIONS = [1, 2, 3, 4, 5].map((v) => ({ label: String(v), value: v }));
const TIME_OPTIONS = [15, 20, 30, 45].map((v) => ({ label: `${v}m`, value: v }));

/**
 * CheckinScreen — pre-session check-in UI (D-01 through D-04).
 *
 * Flow:
 *   1. On mount: fetch /api/coach with intent='checkin' for greeting → stream TTS → play via audioQueue
 *   2. User taps energy (1-5) and time (15/20/30/45)
 *   3. Re-fetch /api/coach with actual values → get session type suggestion → display + play
 *   4. User accepts → acceptSessionType() → audioQueue.initialize() → navigate to /session
 *   5. "Just row" → skipCheckin() → audioQueue.initialize() → navigate to /session
 *
 * CRITICAL: audioQueue.initialize() MUST be called inside a button click handler (Chrome autoplay policy).
 */
export function CheckinScreen() {
  const router = useRouter();

  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null);
  const [selectedTime, setSelectedTime] = useState<TimeAvailable | null>(null);
  const [greetingText, setGreetingText] = useState<string>('');
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [isLoadingGreeting, setIsLoadingGreeting] = useState(true);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [sessionTypeAccepted, setSessionTypeAccepted] = useState(false);

  const setCheckinData = useCoachingStore((s) => s.setCheckinData);
  const setSuggestedSessionType = useCoachingStore((s) => s.setSuggestedSessionType);
  const acceptSessionType = useCoachingStore((s) => s.acceptSessionType);
  const skipCheckin = useCoachingStore((s) => s.skipCheckin);

  // Guard: only fetch greeting once
  const greetingFetched = useRef(false);
  // Guard: debounce selection fetch
  const suggestionAbortRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // On mount: fetch initial greeting with default energy/time
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (greetingFetched.current) return;
    greetingFetched.current = true;

    const fetchGreeting = async () => {
      setIsLoadingGreeting(true);
      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'checkin',
            sessionContext: { energyLevel: 3, timeAvailableMin: 20 },
          }),
        });

        if (!res.ok || !res.body) {
          setGreetingText("Let's get you set up for today's session.");
          setIsLoadingGreeting(false);
          return;
        }

        const fullText = await streamSseText(res);
        setGreetingText(fullText);
        setIsLoadingGreeting(false);

        // Play greeting via TTS (no user gesture needed for first load — audioQueue.initialize()
        // will be called on button press; this just buffers the text for display)
        if (fullText) {
          void playTextViaTts(fullText);
        }
      } catch {
        setGreetingText("Ready when you are — let's row.");
        setIsLoadingGreeting(false);
      }
    };

    void fetchGreeting();
  }, []);

  // ---------------------------------------------------------------------------
  // When energy+time selected: fetch session type suggestion
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedEnergy || !selectedTime) return;

    // Cancel any in-flight suggestion request
    suggestionAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionAbortRef.current = controller;

    const fetchSuggestion = async () => {
      setIsLoadingSuggestion(true);
      setSuggestionText('');
      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'checkin',
            sessionContext: {
              energyLevel: selectedEnergy,
              timeAvailableMin: selectedTime,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setSuggestionText('Steady state session');
          setIsLoadingSuggestion(false);
          return;
        }

        const fullText = await streamSseText(res);
        setSuggestionText(fullText);
        setSuggestedSessionType(fullText);
        setIsLoadingSuggestion(false);

        if (fullText) {
          void playTextViaTts(fullText);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSuggestionText('Steady state session');
        setIsLoadingSuggestion(false);
      }
    };

    void fetchSuggestion();
  }, [selectedEnergy, selectedTime, setSuggestedSessionType]);

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------

  const handleAccept = () => {
    if (!selectedEnergy || !selectedTime) return;
    setCheckinData(selectedEnergy, selectedTime);
    acceptSessionType();
    setSessionTypeAccepted(true);
    // MUST call audioQueue.initialize() inside this user gesture handler
    audioQueue.initialize();
    router.push('/session');
  };

  const handleJustRow = () => {
    skipCheckin();
    // MUST call audioQueue.initialize() inside this user gesture handler
    audioQueue.initialize();
    router.push('/session');
  };

  const handleEnergySelect = (value: string | number) => {
    setSelectedEnergy(value as EnergyLevel);
  };

  const handleTimeSelect = (value: string | number) => {
    setSelectedTime(value as TimeAvailable);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const showSuggestion = !!(selectedEnergy && selectedTime && (suggestionText || isLoadingSuggestion));
  const canAccept = !!(selectedEnergy && selectedTime && suggestionText && !isLoadingSuggestion);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white px-4 pt-safe-top pb-safe-bottom">
      {/* Coach greeting at top */}
      <div className="flex-1 flex flex-col justify-start pt-12 gap-6">
        {/* Greeting */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 min-h-[80px] flex items-center">
          {isLoadingGreeting ? (
            <p className="text-gray-400 text-sm animate-pulse">Coach is connecting...</p>
          ) : (
            <p className="text-white text-base leading-relaxed">{greetingText}</p>
          )}
        </div>

        {/* Energy level selection (D-02) */}
        <TapInputRow
          label="How's your energy today?"
          options={ENERGY_OPTIONS}
          selected={selectedEnergy}
          onSelect={handleEnergySelect}
        />

        {/* Time available selection (D-02) */}
        <TapInputRow
          label="How much time do you have?"
          options={TIME_OPTIONS}
          selected={selectedTime}
          onSelect={handleTimeSelect}
        />

        {/* Session type suggestion (PRES-02, D-03) */}
        {showSuggestion && (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 min-h-[64px]">
            {isLoadingSuggestion ? (
              <p className="text-gray-400 text-sm animate-pulse">Thinking...</p>
            ) : (
              <p className="text-white text-base">{suggestionText}</p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — pinned to bottom */}
      <div className="flex flex-col gap-3 pb-6 pt-4">
        {/* Accept button — visible after suggestion is ready (PRES-03) */}
        {canAccept && !sessionTypeAccepted && (
          <button
            onClick={handleAccept}
            className="w-full min-h-[56px] rounded-2xl bg-white text-black font-semibold text-base active:bg-gray-200 transition-colors"
          >
            Start Session
          </button>
        )}

        {/* Just row — always visible (D-04) */}
        <button
          onClick={handleJustRow}
          className="w-full min-h-[48px] rounded-2xl border border-gray-700 text-gray-300 font-medium text-base active:bg-gray-900 transition-colors"
        >
          Just row
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stream SSE text from a /api/coach response.
 * Collects all text delta chunks and returns the full buffered string.
 */
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
        const parsed = JSON.parse(payload) as { text?: string; error?: string };
        if (parsed.text) {
          fullText += parsed.text;
        }
      } catch {
        // Malformed SSE line — skip
      }
    }
  }

  return fullText;
}

/**
 * Play text via /api/tts and pipe chunks to audioQueue.
 * Called after LLM response is buffered.
 * Non-blocking — errors are swallowed so the UI doesn't break.
 */
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
          const parsed = JSON.parse(payload) as { type?: string; data?: string; done?: boolean };
          if (parsed.type === 'chunk' && parsed.data) {
            await audioQueue.playChunk(parsed.data, 24000);
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } catch {
    // TTS errors are non-fatal — text is already displayed on screen
  }
}
