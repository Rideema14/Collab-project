import clsx from 'clsx';
import { initials } from '@/lib/format';

/**
 * An initials chip for an assignee. There are no avatar images in the system —
 * the users table stores only id, name, email — so this is the honest
 * representation rather than a placeholder photo service.
 */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      // The name is already rendered as text next to this in every usage,
      // so the chip itself is decorative to a screen reader.
      aria-hidden="true"
      className={clsx(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-on-soft',
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
