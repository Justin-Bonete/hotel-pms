import type { ReactNode } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';

/** Email links (verify, reset) work whether or not you are signed in. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
