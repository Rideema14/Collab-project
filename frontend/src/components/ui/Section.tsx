'use client';

/** A titled content block with an optional right-aligned header action. */
export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {subtitle && <p className="text-sm text-text-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A bordered, header-rowed data table on the semantic token layer. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
