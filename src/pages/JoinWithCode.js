import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SignUp from './SignUp';

export default function JoinWithCode() {
  const [searchParams] = useSearchParams();
  const prefilledCode = useMemo(() => {
    const raw = searchParams.get('code') ?? searchParams.get('invite') ?? '';
    return String(raw).trim();
  }, [searchParams]);

  return <SignUp prefilledCode={prefilledCode} />;
}
