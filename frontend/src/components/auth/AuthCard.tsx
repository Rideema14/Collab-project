import Link from 'next/link';

/**
 * Shared chrome for the two auth screens (login + register), so they can't drift
 * apart visually. A branded, always-dark cosmic split-screen: a starfield hero on
 * the left and the sign-in form on a glass card to the right. All visuals are pure
 * CSS/SVG — no image assets — and collapse to a single column on mobile.
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
    <main className="cosmic-auth relative min-h-dvh w-full overflow-hidden bg-[#05070d] text-white">
      <CosmicBackdrop />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row">
        {/* Brand / hero */}
        <section className="flex flex-1 flex-col justify-between px-6 pb-4 pt-8 lg:px-12 lg:py-14">
          <BrandMark />

          <div className="my-8 lg:my-0">
            <h2 className="text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              <span className="bg-gradient-to-br from-white to-white/55 bg-clip-text text-transparent">
                Plan your team&rsquo;s work
              </span>
              <br />
              <span className="bg-gradient-to-r from-[#a78bfa] via-[#6366f1] to-[#22d3ee] bg-clip-text text-transparent">
                effortlessly.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
              Kuberya keeps every task, status, and deadline on one calm, shared board — so nothing
              slips through the cracks.
            </p>
          </div>

          <p className="hidden text-xs text-white/35 lg:block">© Kuberya · Built for teams</p>
        </section>

        {/* Form */}
        <section className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-12 lg:py-14">
          <div className="w-full max-w-sm">
            <div className="mb-6">
              {/* Exactly one <h1> per page (SEO). */}
              <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-1.5 text-sm text-white/55">{subtitle}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_12px_48px_-16px_rgba(0,0,0,0.75)] backdrop-blur-xl">
              {children}
            </div>

            <p className="mt-6 text-center text-sm text-white/55">
              {footer.prompt}{' '}
              <Link href={footer.href} className="font-medium text-[#93b4ff] hover:text-white hover:underline">
                {footer.linkText}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Kuberya orbit mark + wordmark. */
function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl shadow-[0_6px_24px_-6px_rgba(99,102,241,0.7)]"
        style={{ background: 'var(--gradient-brand)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" transform="rotate(-30 12 12)" />
          <circle cx="12" cy="12" r="3" fill="white" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">Kuberya</span>
    </div>
  );
}

/** Layered cosmic background: nebula wash, light beam, starfield, planet glow, orbit ring. */
function CosmicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* nebula wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 12% -10%, rgba(70,100,230,0.34), transparent 55%),' +
            'radial-gradient(90% 70% at 92% 8%, rgba(139,92,246,0.20), transparent 60%),' +
            'radial-gradient(130% 90% at 50% 125%, rgba(34,211,238,0.22), transparent 55%)',
        }}
      />
      {/* diagonal light beam from top-left */}
      <div
        className="absolute -left-1/4 -top-1/3 h-[150%] w-[55%] rotate-[20deg] blur-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(130,170,255,0.30), transparent 60%)' }}
      />
      {/* starfield (two tiled layers for depth) */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 10% 20%, rgba(255,255,255,0.95), transparent),' +
            'radial-gradient(1.5px 1.5px at 70% 14%, rgba(255,255,255,0.8), transparent),' +
            'radial-gradient(2px 2px at 32% 60%, #fff, transparent),' +
            'radial-gradient(1px 1px at 85% 48%, rgba(255,255,255,0.7), transparent),' +
            'radial-gradient(1.5px 1.5px at 52% 82%, rgba(255,255,255,0.85), transparent),' +
            'radial-gradient(1px 1px at 20% 92%, rgba(255,255,255,0.6), transparent),' +
            'radial-gradient(1px 1px at 92% 86%, rgba(255,255,255,0.7), transparent)',
          backgroundRepeat: 'repeat',
          backgroundSize: '340px 340px',
        }}
      />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.7), transparent),' +
            'radial-gradient(1px 1px at 65% 55%, rgba(255,255,255,0.6), transparent),' +
            'radial-gradient(1px 1px at 45% 15%, rgba(255,255,255,0.55), transparent),' +
            'radial-gradient(1px 1px at 80% 75%, rgba(255,255,255,0.6), transparent)',
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />
      {/* planet glow rising from the bottom */}
      <div
        className="absolute -bottom-48 left-1/2 h-[26rem] w-[46rem] -translate-x-1/2 rounded-full opacity-70 blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.40), rgba(59,130,246,0.18) 42%, transparent 70%)',
        }}
      />
      {/* faint orbital arc */}
      <div className="absolute -bottom-[34rem] left-1/2 h-[50rem] w-[50rem] -translate-x-1/2 rounded-full border border-white/10" />
      {/* vignette to seat the content */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 50%, transparent 60%, rgba(2,3,8,0.55))' }}
      />
    </div>
  );
}
