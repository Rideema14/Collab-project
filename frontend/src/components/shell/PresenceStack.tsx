'use client';

import { useAppSelector } from '@/store/hooks';
import { selectPresencePeers, selectSelfClientId } from '@/store/selectors';
import { AvatarStack } from '@/components/domain/AvatarStack';
import { Tooltip } from '@/components/ui/Tooltip';

/** Live presence — everyone currently connected (this browser's tabs, and real
 * peers when a Socket.IO server is configured). */
export function PresenceStack() {
  const peers = useAppSelector(selectPresencePeers);
  const self = useAppSelector(selectSelfClientId);

  // De-dupe by user id (a user with two tabs counts once), keep self first.
  const seen = new Set<number>();
  const people: { id: number; name: string }[] = [];
  for (const peer of Object.values(peers)) {
    if (seen.has(peer.userId)) continue;
    seen.add(peer.userId);
    people.push({ id: peer.userId, name: peer.clientId === self ? `${peer.name} (you)` : peer.name });
  }

  if (people.length === 0) return null;
  return (
    <Tooltip content={`${people.length} online`}>
      <div className="flex items-center">
        <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
        <AvatarStack people={people} size={26} max={4} />
      </div>
    </Tooltip>
  );
}
