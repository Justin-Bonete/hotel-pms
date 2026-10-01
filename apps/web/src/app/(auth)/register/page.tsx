'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@pms/validation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Create your organization</h1>
        <p className="mt-1 text-sm text-slate-500">You become the Owner. Add properties and staff after signing up.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Company or group name" error={errors.organizationName?.message} {...register('organizationName')} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
        <Field label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <Field label="Work email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
      <Field label="Password (12+ characters)" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
