'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Client-side route guard.
 *
 * This is honest about what it is: a UX affordance, not a security boundary.
 * The real gate is the backend's requireAuth middleware, which rejects every
 * projects/tasks/users/voice request without a valid Bearer token. Hiding the
 * page here just spares the user a screen full of failed requests.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  // 'loading' means we haven't read localStorage yet — showing the login page
  // here would flash it at users who are, in fact, signed in.
  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" label="Loading your workspace" className="text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
