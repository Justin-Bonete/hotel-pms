'use client';

import { passwordSchema } from '@pms/validation';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Spinner } from '@/components/ui/ui';
import { api } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password }, false);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <Alert tone="error">This reset link is missing its token. Please request a new one.</Alert>;
  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">Your password was changed. You were signed out everywhere.</Alert>
        <Link href="/login" className="block text-center text-sm font-medium text-indigo-600 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="New password (12+ characters)" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError} />
      <Button type="submit" className="w-full" loading={busy}>
        Change password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetForm />
    </Suspense>
  );
}
