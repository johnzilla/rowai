'use client';

interface SessionEndPromptProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * SessionEndPrompt — shown after 30s of no strokes to confirm session end.
 *
 * D-09: Triggered by useSessionLifecycle after 30s idle.
 * D-10: If the user starts rowing while this is showing, useSessionLifecycle
 *       will call onDismiss automatically (via sessionPhase state change).
 *
 * Rendered as a centered overlay so metrics remain visible underneath.
 */
export function SessionEndPrompt({ onConfirm, onDismiss }: SessionEndPromptProps) {
  return (
    <div className="fixed inset-0 flex items-end justify-center pb-16 px-6 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />

      {/* Prompt card */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <p className="text-white text-xl font-semibold text-center">Done rowing?</p>
        <p className="text-gray-400 text-sm text-center">
          No strokes detected for 30 seconds.
        </p>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-xl border border-gray-600 text-white font-medium text-base"
          >
            Continue
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold text-base"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
