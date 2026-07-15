'use client';

import { use } from 'react';
import { ListWorkspace } from '@/features/list/ListWorkspace';

/** A List — the 7-view workspace (Board/List/Table/Calendar/Timeline/Workload/Gantt). */
export default function ListPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  return <ListWorkspace listId={listId} />;
}
