import Link from 'next/link';

/** Shared chrome for the two auth screens, so they can't drift apart visually. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: { prompt: string; linkText: string; href: string };
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* Exactly one <h1> per page (Playbook, SEO basics). */}
          <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>

        <p className="mt-6 text-center text-sm text-text-muted">
          {footer.prompt}{' '}
          <Link href={footer.href} className="rounded-sm font-medium text-primary hover:underline">
            {footer.linkText}
          </Link>
        </p>
      </div>
    </main>
  );
}
