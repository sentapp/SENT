import { useEffect, useMemo } from 'react';

export const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

export function PinDots({ digits, max = 4 }) {
  const filled = useMemo(() => digits.length, [digits]);
  return (
    <div className="mb-12 flex justify-center gap-6" aria-label="PIN progress">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition ${
            i < filled ? 'border-mission-blue bg-mission-blue' : 'border-neutral-300 bg-white'
          }`}
        />
      ))}
    </div>
  );
}

export function PinKeypad({ onKey, keyboard = true }) {
  useEffect(() => {
    if (!keyboard || typeof window === 'undefined') return undefined;

    const onDown = (e) => {
      const el = e.target;
      if (
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        onKey('back');
        return;
      }
      let digit = null;
      if (e.key.length === 1 && e.key >= '0' && e.key <= '9') {
        digit = e.key;
      } else if (e.code?.startsWith('Numpad') && e.code.length === 7) {
        const d = e.code.slice(6);
        if (d >= '0' && d <= '9') digit = d;
      }
      if (digit != null) {
        e.preventDefault();
        onKey(digit);
      }
    };

    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [onKey, keyboard]);

  return (
    <div className="grid grid-cols-3 gap-x-10 gap-y-5 px-6">
      {PIN_KEYS.map((k, idx) =>
        k === '' ? (
          <span key={`empty-${idx}`} />
        ) : k === 'back' ? (
          <button
            key="back"
            type="button"
            onClick={() => onKey('back')}
            className="flex h-[52px] items-center justify-center text-lg font-semibold text-neutral-500 hover:text-neutral-800"
            aria-label="Delete"
          >
            ⌫
          </button>
        ) : (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            className="flex h-[52px] items-center justify-center rounded-btn text-2xl font-medium text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200"
          >
            {k}
          </button>
        ),
      )}
    </div>
  );
}
