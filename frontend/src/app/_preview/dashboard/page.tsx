import { DashboardView } from '@/features/dashboard/DashboardView';

/** TEMP: unauthenticated visual-QA route, bypasses RequireAuth. Delete after review. */
export default function PreviewDashboardPage() {
  return <DashboardView />;
}
