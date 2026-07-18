import Link from 'next/link';

/**
 * Shared chrome for the two auth screens (login + register), so they can't drift
 * apart visually. Matches the login screen's identity exactly: solid orange
 * (#5f7216, no gradient), a white card for the form, black/white text only —
 * classy and business, not decorative. Forced via `.light-scope` so the card's
 * token-based form controls render light regardless of the app's own theme.
 */
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
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#b3cc33] font-sans text-[#141807]">
      {/* faint diagonal texture, matching the login screen — no color gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(100deg, transparent 0px, transparent 54px, rgba(255,255,255,0.6) 54px, rgba(255,255,255,0.6) 55px)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row">
        {/* Brand / hero */}
        <section className="flex flex-1 flex-col justify-between px-6 pb-4 pt-8 lg:px-12 lg:py-14">
          <BrandMark />

          <div className="my-8 lg:my-0">
            <h2 className="text-[2.1rem] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Plan &amp; Meet
              <br />
              with Kuberya.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#141807]/80">
              Kuberya keeps every task, status, and deadline on one calm, shared board — so nothing
              slips through the cracks.
            </p>
          </div>

          <p className="hidden text-xs text-[#141807]/60 lg:block">© Kuberya · Built for teams</p>
        </section>

        {/* Form */}
        <section className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-12 lg:py-14">
          <div className="w-full max-w-sm">
            <div className="mb-6">
              {/* Exactly one <h1> per page (SEO). */}
              <h1 className="text-2xl font-extrabold tracking-tight text-[#141807]">{title}</h1>
              <p className="mt-1.5 text-sm text-[#141807]/70">{subtitle}</p>
            </div>

            <div className="light-scope rounded-2xl bg-[#ffffff] p-6 shadow-[0_20px_60px_-16px_rgba(20,8,0,0.45)]">
              {children}
            </div>

            <p className="mt-6 text-center text-sm text-[#141807]/70">
              {footer.prompt}{' '}
              <Link href={footer.href} className="font-bold text-[#141807] hover:underline">
                {footer.linkText}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Kuberya isometric-cube mark — shared with the login screen. */
function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2 21 7v10l-9 5-9-5V7Z" stroke="#141807" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M3 7 12 12l9-5M12 12v10" stroke="#141807" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-[#141807]">Kuberya</span>
    </div>
  );
}
