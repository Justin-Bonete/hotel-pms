'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';
import { Spinner } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';

/** Sign-in / register / forgot-password: signed-in users are sent to the dashboard. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.parent !== window);
  }, []);

  useEffect(() => {
    if (embedded) {
      window.parent.postMessage({ type: 'pms:auth-route', path: pathname }, window.location.origin);
    }
  }, [embedded, pathname]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (embedded) {
      window.parent.postMessage({ type: 'pms:auth-success' }, window.location.origin);
    } else {
      router.replace('/dashboard');
    }
  }, [embedded, status, router]);

  if (status !== 'anonymous') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <AuthShell embedded={embedded}>{children}</AuthShell>;
}
