import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from './ui';
import { PinDots, PinKeypad } from './PinEntry';
import { hasLocalPin, removeLocalPin, saveLocalPin, verifyLocalPin } from '../lib/localPin';

function pinStepTitle(step) {
  switch (step) {
    case 'verify':
      return 'Enter your current PIN';
    case 'setup_first':
      return 'Create a 4-digit PIN';
    case 'setup_confirm':
      return 'Confirm your PIN';
    case 'change_first':
      return 'Enter a new PIN';
    case 'change_confirm':
      return 'Confirm new PIN';
    default:
      return '';
  }
}

export default function LocalPinSettingsSection({ userId }) {
  const [hasPin, setHasPin] = useState(false);
  const [pinStep, setPinStep] = useState(null);
  const [pinBuf, setPinBuf] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    if (!userId) {
      setHasPin(false);
      return;
    }
    setHasPin(hasLocalPin(userId));
  }, [userId, pinStep]);

  useEffect(() => {
    if (pinStep) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [pinStep]);

  const closePanel = useCallback(() => {
    setPinStep(null);
    setPinBuf('');
    setFirstPin('');
    setPinMsg('');
  }, []);

  const handleKey = (k) => {
    setPinMsg('');
    if (!pinStep) return;
    if (k === 'enter') return;
    if (k === 'back') {
      setPinBuf((p) => p.slice(0, -1));
      return;
    }
    setPinBuf((p) => {
      if (p.length >= 4) return p;
      const next = p + k;
      if (next.length < 4) return next;

      if (pinStep === 'verify') {
        if (!verifyLocalPin(userId, next)) {
          setPinMsg('Incorrect PIN');
          return '';
        }
        setFirstPin('');
        setPinStep('change_first');
        return '';
      }

      if (pinStep === 'setup_first' || pinStep === 'change_first') {
        setFirstPin(next);
        setPinStep(pinStep === 'setup_first' ? 'setup_confirm' : 'change_confirm');
        return '';
      }

      if (pinStep === 'setup_confirm' || pinStep === 'change_confirm') {
        if (next !== firstPin) {
          setPinMsg('PINs do not match. Start again.');
          setPinStep(pinStep === 'setup_confirm' ? 'setup_first' : 'change_first');
          setFirstPin('');
          return '';
        }
        saveLocalPin(userId, next);
        setHasPin(true);
        closePanel();
        return '';
      }

      return next;
    });
  };

  if (!userId) return null;

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">Security</p>
      <p className="mt-1 text-xs text-neutral-500">
        Optional 4-digit PIN for quick unlock on this device. Stored locally only, not in the cloud.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {hasPin ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPinBuf('');
                setFirstPin('');
                setPinMsg('');
                setPinStep('verify');
              }}
            >
              Change PIN
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (window.confirm('Remove PIN from this device? You can sign in with email and password anytime.')) {
                  removeLocalPin(userId);
                  setHasPin(false);
                }
              }}
            >
              Remove PIN
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPinBuf('');
              setFirstPin('');
              setPinMsg('');
              setPinStep('setup_first');
            }}
          >
            Set up PIN
          </Button>
        )}
      </div>

      {pinStep ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePanel();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-pin-settings-title"
            style={{
              background: 'white',
              borderRadius: 20,
              padding: '24px',
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 20,
                color: '#888',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <p id="local-pin-settings-title" className="pr-8 text-center text-sm font-semibold text-ink">
              {pinStepTitle(pinStep)}
            </p>
            {pinMsg ? <p className="mt-2 text-center text-sm text-red-600">{pinMsg}</p> : null}
            <PinDots digits={pinBuf} />
            <PinKeypad onKey={handleKey} />
            <Button type="button" variant="secondary" className="mt-4 w-full" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
