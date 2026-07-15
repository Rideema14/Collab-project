import { RequireAuth } from '@/components/layout/RequireAuth';
import { AppShell } from '@/components/shell/AppShell';
import { ProjectProvider } from '@/components/project/ProjectProvider';
import { ProjectChrome } from '@/components/project/ProjectChrome';

/**
 * Shared frame for every project view. The provider fetches the board once and
 * the chrome renders the header + tab bar; each nested route (Overview, Board,
 * List, Calendar, Analytics, Activity) renders only its own content and reads
 * the shared data via useProject().
 */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>
        <ProjectProvider>
          <ProjectChrome>{children}</ProjectChrome>
        </ProjectProvider>
      </AppShell>
    </RequireAuth>
  );
}
