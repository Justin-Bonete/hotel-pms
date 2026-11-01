'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';
import { Spinner } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';

/** Sign-in / register / forgot-password: signed-in users are sent to the dashboard. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status !== 'anonymous') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <AuthShell>{children}</AuthShell>;
}
