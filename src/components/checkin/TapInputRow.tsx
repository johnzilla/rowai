'use client';

interface TapOption {
  label: string;
  value: string | number;
}

interface TapInputRowProps {
  label: string;
  options: TapOption[];
  selected: string | number | null;
  onSelect: (value: string | number) => void;
}

/**
 * TapInputRow — reusable row of large tap buttons for check-in selections.
 *
 * Per D-02: tap-only input during check-in.
 * Touch targets: minimum 48px height per CONTEXT.md specifics.
 * Styling: black background, mobile-first, consistent with Phase 1 design.
 */
export function TapInputRow({ label, options, selected, onSelect }: TapInputRowProps) {
  return (
    <div className="w-full">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={[
                'flex-1 min-w-[48px] min-h-[48px] px-3 py-3',
                'rounded-2xl text-base font-semibold',
                'transition-colors duration-150',
                isSelected
                  ? 'bg-white text-black'
                  : 'bg-transparent border border-gray-700 text-white active:bg-gray-800',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
