'use client';

import { use } from 'react';
import { MeetingDetailView } from '@/features/meetings/MeetingDetailView';

export default function MeetingDetailPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  return <MeetingDetailView meetingId={Number(meetingId)} />;
}
