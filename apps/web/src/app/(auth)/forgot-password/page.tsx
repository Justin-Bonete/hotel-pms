'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@pms/validation';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field } from '@/components/ui/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', values, false);
      setMessage(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset link.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your email and we will send you a reset link.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message} In development, the link is printed in the API console.</Alert>}
      <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
