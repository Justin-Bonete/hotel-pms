'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Alert, Spinner } from '@/components/ui/ui';
import { api } from '@/lib/api';

function Verify() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'working' | 'ok' | 'error'>(token ? 'working' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its token.');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // one-time token: never submit twice (StrictMode)
    started.current = true;
    api
      .post('/auth/verify-email', { token }, false)
      .then(() => setState('ok'))
      .catch((e: unknown) => {
        setState('error');
        setMessage(e instanceof Error ? e.message : 'Could not verify your email.');
      });
  }, [token]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Email verification</h1>
      {state === 'working' && <Spinner label="Verifying" />}
      {state === 'ok' && <Alert tone="success">Your email is verified. Thank you!</Alert>}
      {state === 'error' && <Alert tone="error">{message}</Alert>}
      <Link href="/dashboard" className="block text-center text-sm font-medium text-indigo-600 hover:underline">
        Continue
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Verify />
    </Suspense>
  );
}
