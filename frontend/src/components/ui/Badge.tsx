import clsx from 'clsx';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  primary: 'bg-primary-soft text-primary-on-soft',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
