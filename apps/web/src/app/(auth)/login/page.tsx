'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@pms/validation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back. Manage all your properties in one place.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-500">
        New here?{' '}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          Create your organization
        </Link>
      </p>
    </form>
  );
}
