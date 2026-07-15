import { RequireAuth } from '@/components/layout/RequireAuth';
import { PlatformShell } from '@/components/shell/PlatformShell';

/**
 * The authenticated platform surface. Sits inside the root layout (which provides
 * the store, theme, toast, and auth), adds the client-side auth guard, and wraps
 * pages in the hierarchy shell. This is a route GROUP — it adds no URL segment.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PlatformShell>{children}</PlatformShell>
    </RequireAuth>
  );
}
