'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, CalendarDays, Video, Box, Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api/client';

export default function KuberyaLoginPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/home');
  }, [status, router]);

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#e76f51] font-sans text-[#ffffff]">
      {/* faint diagonal ray lines across the whole canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(100deg, transparent 0px, transparent 54px, rgba(255,255,255,0.6) 54px, rgba(255,255,255,0.6) 55px)',
          maskImage: 'radial-gradient(75% 75% at 22% 45%, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(75% 75% at 22% 45%, black 40%, transparent 85%)',
        }}
      />

      <div className="relative z-10 flex min-h-dvh w-full flex-col">
        {/* ==========================================
            HEADER: brand mark left, Login pinned to the extreme right
            (centered as a stack on mobile)
           ========================================== */}
        <div className="mx-auto flex w-full max-w-[1680px] flex-col items-center gap-4 px-6 pt-8 text-center sm:px-10 sm:pt-10 md:flex-row md:items-center md:justify-between md:px-14 md:text-left xl:px-20">
          <BrandMark />
          <button
            onClick={() => openModal('signin')}
            className="rounded-full border border-[#ffffff]/25 bg-[#ffffff]/10 px-6 py-2.5 text-xs font-bold text-[#ffffff] backdrop-blur-md transition-all hover:bg-[#ffffff]/20"
          >
            Login
          </button>
        </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-14 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:gap-8 lg:px-14 lg:py-0 xl:px-20">
        {/* ==========================================
            LEFT: Brand copy
           ========================================== */}
        <div className="flex w-full flex-col items-center gap-10 text-center lg:w-[42%] lg:shrink-0 lg:items-start lg:text-left">
          <div>
            <h1 className="text-[2.6rem] font-black leading-[1.04] tracking-tight sm:text-6xl xl:text-[4rem]">
              Plan &amp; Meet
              <br />
              with Kuberya.
            </h1>

            <ul className="mt-8 flex flex-col items-center gap-4 lg:items-start">
              {['Light & Dark Mode', 'Fully Customizable', 'Well Organized', '+50 Screen'].map((label) => (
                <li key={label} className="flex items-center gap-3 text-base font-bold">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffffff] text-[#080e11]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center justify-center gap-4 lg:justify-start">
              <button
                onClick={() => openModal('signup')}
                className="rounded-full bg-[#ffffff] px-8 py-3.5 text-sm font-extrabold text-[#e76f51] shadow-[0_16px_32px_-10px_rgba(0,0,0,0.35)] transition-all hover:scale-105"
              >
                Start Free
              </button>
            </div>
          </div>

          {/* Integration badges */}
          <div className="mt-2 flex items-center justify-center gap-3 lg:justify-start">
            <ToolBadge>
              <Video size={18} color="#e76f51" strokeWidth={1.8} />
            </ToolBadge>
            <ToolBadge>
              <CalendarDays size={18} color="#0f1c22" strokeWidth={1.8} />
            </ToolBadge>
            <ToolBadge>
              <MessageSquare size={18} color="#e76f51" strokeWidth={1.8} />
            </ToolBadge>
          </div>
        </div>

        {/* ==========================================
            RIGHT: Device showcase
           ========================================== */}
        <div className="relative w-full flex-1 lg:h-full">
          {/* The laptop + phone is ONE scene that scales as a single unit (via
              container-query units), so mobile and desktop show the exact same
              composition — only larger or smaller. */}
          <div
            className="relative mx-auto w-full max-w-[520px] py-4 sm:max-w-[600px] lg:absolute lg:inset-y-0 lg:right-[-4%] lg:my-auto lg:h-fit lg:max-w-[720px] xl:right-[-8%] xl:max-w-[800px]"
            style={{ containerType: 'inline-size' }}
          >
            {/* MacBook — the sizing anchor for the whole scene */}
            <div className="relative w-full">
              {/* Lid: dark aluminium bezel around the display */}
              <div className="relative overflow-hidden rounded-[1.4cqw] border-[1.05cqw] border-b-0 border-[#0d1014] bg-[#0d1014] shadow-[0_6cqw_9cqw_-4cqw_rgba(8,5,2,0.5)]">
                <div
                  className="relative aspect-[16/10] w-full overflow-hidden bg-white"
                  style={{ containerType: 'inline-size' }}
                >
                  <LaptopScreen />
                  {/* camera notch */}
                  <span className="absolute left-1/2 top-0 z-40 h-[2cqw] w-[8.5cqw] -translate-x-1/2 rounded-b-[1cqw] bg-[#0d1014]" />
                  {/* display gloss */}
                  <span className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/45 via-transparent to-black/[0.05]" />
                </div>
              </div>
              {/* Hinge line, then the silver base deck with a front cutout */}
              <div className="mx-auto h-[0.7cqw] w-full bg-[#05070a]" />
              <div className="relative mx-auto h-[1.7cqw] w-[113%] -translate-x-[6.5%] rounded-b-[1cqw] bg-gradient-to-b from-[#e0e3e8] via-[#c4c8cf] to-[#a3a8b0] shadow-[0_5cqw_7cqw_-3cqw_rgba(8,5,2,0.45)]">
                <span className="absolute left-1/2 top-0 h-[52%] w-[13%] -translate-x-1/2 rounded-b-[0.7cqw] bg-gradient-to-b from-[#9a9fa8] to-[#bcc0c7]" />
              </div>

              {/* iPhone — sized as a % of the laptop and laid over its lower-left
                  corner, so the composition is identical at every screen size. */}
              <div className="absolute bottom-[4%] left-[-4%] z-20 w-[24%] rotate-[-9deg]">
                <PhoneMock />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Pop-up Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setIsAuthModalOpen(false)} />
      )}
    </main>
  );
}

// ==========================================
// BRAND MARKS — isometric cube motif
// ==========================================
function CubeGlyph({ stroke = '#ffffff', size = 20, className }: { stroke?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2 21 7v10l-9 5-9-5V7Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7 12 12l9-5M12 12v10" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <CubeGlyph size={26} />
      <span className="text-lg font-extrabold tracking-tight text-[#ffffff]">Kuberya</span>
    </div>
  );
}

// ==========================================
// DEVICE SCREENS — real marketing UI, matching the reference showcase. Text and
// chrome are sized in cqw (container-query width) units so everything scales
// with the device it sits in and reads the same on mobile and desktop.
// ==========================================

/**
 * Faint orange integration logos connected by flowing lines that converge into a
 * central cube — the signature motif from the reference marketing site.
 * `compact` enlarges the marks a touch for the narrower phone screen.
 */
function IntegrationCluster({ compact = false }: { compact?: boolean }) {
  const cube = { x: 82, y: 62 };
  const icons = [
    { x: 46, y: 50, bg: '#e5484d', Icon: MessageSquare },
    { x: 44, y: 78, bg: '#0f1c22', Icon: CalendarDays },
    { x: 63, y: 71, bg: '#e76f51', Icon: Video },
  ];
  const s = compact ? 1.35 : 1;
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {icons.map((ic, i) => (
          <path
            key={i}
            d={`M ${ic.x} ${ic.y} C ${(ic.x + cube.x) / 2} ${ic.y}, ${(ic.x + cube.x) / 2} ${cube.y}, ${cube.x} ${cube.y}`}
            fill="none"
            stroke="#e76f51"
            strokeWidth={compact ? 0.7 : 0.45}
            strokeOpacity="0.55"
          />
        ))}
        {[-18, -10, -2, 6, 14, 22].map((dy, i) => (
          <path
            key={`f-${i}`}
            d={`M ${cube.x} ${cube.y} C ${(cube.x + 104) / 2} ${cube.y}, ${(cube.x + 104) / 2} ${cube.y + dy}, 104 ${cube.y + dy}`}
            fill="none"
            stroke="#e76f51"
            strokeWidth={compact ? 0.45 : 0.28}
            strokeOpacity="0.3"
          />
        ))}
      </svg>
      {icons.map((ic, i) => (
        <span
          key={i}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center shadow-[0_2cqw_3cqw_-1cqw_rgba(0,0,0,0.35)]"
          style={{
            left: `${ic.x}%`,
            top: `${ic.y}%`,
            width: `${6 * s}cqw`,
            height: `${6 * s}cqw`,
            borderRadius: `${1.7 * s}cqw`,
            backgroundColor: ic.bg,
          }}
        >
          <ic.Icon color="#ffffff" strokeWidth={2.2} style={{ width: `${3.3 * s}cqw`, height: `${3.3 * s}cqw` }} />
        </span>
      ))}
      <span
        className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center bg-[#f0603a] shadow-[0_3cqw_5cqw_-1cqw_rgba(231,111,81,0.55)]"
        style={{ left: `${cube.x}%`, top: `${cube.y}%`, width: `${9.5 * s}cqw`, height: `${9.5 * s}cqw`, borderRadius: `${2.6 * s}cqw` }}
      >
        <Box color="#ffffff" strokeWidth={2} style={{ width: `${5.4 * s}cqw`, height: `${5.4 * s}cqw` }} />
      </span>
    </div>
  );
}

function LaptopScreen() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      {/* Nav */}
      <div className="flex items-center justify-between px-[4cqw] pt-[3.4cqw]">
        <div className="flex items-center gap-[1.2cqw]">
          <span className="grid h-[3cqw] w-[3cqw] place-items-center rounded-[0.9cqw] bg-[#0f1c22]">
            <Box className="text-white" strokeWidth={2.4} style={{ width: '2cqw', height: '2cqw' }} />
          </span>
          <span className="text-[2.1cqw] font-extrabold tracking-tight text-[#0f1c22]">Kuberya</span>
        </div>
        <div className="flex items-center gap-[2.6cqw] text-[1.4cqw] font-semibold text-[#6b7280]">
          <span className="flex items-center gap-[0.5cqw] text-[#0f1c22]">
            Product <ChevronDown style={{ width: '1.4cqw', height: '1.4cqw' }} />
          </span>
          <span>Boards</span>
          <span>Meetings</span>
          <span>Integrations</span>
          <span>Developers</span>
        </div>
      </div>

      {/* Hero */}
      <div className="mt-[6cqw] max-w-[60%] px-[4cqw]">
        <h2 className="text-[5.6cqw] font-black leading-[1.02] tracking-tight text-[#0f1c22]">
          Plan the work.
          <br />
          Meet with purpose.
        </h2>
        <p className="mt-[2.4cqw] max-w-[86%] text-[1.7cqw] leading-relaxed text-[#8a8f99]">
          Boards, meetings, and AI summaries — your whole team, always in sync.
        </p>
        <div className="mt-[3.2cqw] flex items-center gap-[2.4cqw]">
          <button className="rounded-full bg-[#e76f51] px-[3.4cqw] py-[1.5cqw] text-[1.6cqw] font-bold text-white shadow-[0_2cqw_4cqw_-1cqw_rgba(231,111,81,0.55)]">
            Start free
          </button>
          <span className="text-[1.4cqw] font-medium text-[#8a8f99]">
            Want a live demo? <span className="font-semibold text-[#e76f51]">Get in touch →</span>
          </span>
        </div>
      </div>

      {/* Integration logos, lower-right */}
      <IntegrationCluster />
    </div>
  );
}

function PhoneScreen() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-[7cqw] pt-[12cqw]">
        <div className="flex items-center gap-[2cqw]">
          <span className="grid h-[7cqw] w-[7cqw] place-items-center rounded-[2cqw] bg-[#0f1c22]">
            <Box className="text-white" strokeWidth={2.4} style={{ width: '4.4cqw', height: '4.4cqw' }} />
          </span>
          <span className="text-[5cqw] font-extrabold tracking-tight text-[#0f1c22]">Kuberya</span>
        </div>
        <Menu className="text-[#0f1c22]" strokeWidth={2.4} style={{ width: '5.5cqw', height: '5.5cqw' }} />
      </div>

      {/* Heading */}
      <div className="mt-[7cqw] px-[7cqw]">
        <h3 className="text-[8.2cqw] font-black leading-[1.05] tracking-tight text-[#0f1c22]">
          Plan the work.
          <br />
          Meet with purpose.
        </h3>
        <p className="mt-[3.4cqw] text-[3.8cqw] leading-relaxed text-[#8a8f99]">
          Boards, meetings, and AI summaries — your team in sync.
        </p>
        <button className="mt-[5cqw] rounded-full bg-[#e76f51] px-[6cqw] py-[3cqw] text-[3.8cqw] font-bold text-white">
          Start free
        </button>
      </div>

      {/* Integration logos */}
      <div className="absolute inset-x-0 bottom-[9cqw] top-[54%]">
        <IntegrationCluster compact />
      </div>

      <p className="absolute bottom-[5cqw] left-[7cqw] text-[3cqw] font-medium text-[#8a8f99]">
        Live demo? <span className="font-semibold text-[#e76f51]">Get in touch →</span>
      </p>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative" style={{ containerType: 'inline-size' }}>
      {/* Titanium side buttons, sized relative to the phone so they scale with it */}
      <span className="absolute -left-[1.6cqw] top-[20%] h-[7%] w-[1.4cqw] rounded-l-[0.8cqw] bg-[#0a0e13]" />
      <span className="absolute -left-[1.6cqw] top-[31%] h-[11%] w-[1.4cqw] rounded-l-[0.8cqw] bg-[#0a0e13]" />
      <span className="absolute -right-[1.6cqw] top-[26%] h-[14%] w-[1.4cqw] rounded-r-[0.8cqw] bg-[#0a0e13]" />

      <div className="overflow-hidden rounded-[9cqw] border-[2.2cqw] border-[#15181d] bg-[#15181d] shadow-[-4cqw_7cqw_12cqw_-3cqw_rgba(8,5,2,0.5)]">
        <div
          className="relative aspect-[9/19] w-full overflow-hidden rounded-[6.5cqw] bg-white"
          style={{ containerType: 'inline-size' }}
        >
          {/* Dynamic island */}
          <span className="absolute left-1/2 top-[3cqw] z-30 h-[7cqw] w-[30cqw] -translate-x-1/2 rounded-full bg-[#0d1014]" />
          <PhoneScreen />
          <span className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/45 via-transparent to-black/[0.05]" />
        </div>
      </div>
    </div>
  );
}

function ToolBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.3)]">
      {children}
    </span>
  );
}

// ==========================================
// AUTHENTICATION MODAL
// ==========================================
function AuthModal({
  mode,
  setMode,
  onClose,
}: {
  mode: 'signin' | 'signup';
  setMode: (mode: 'signin' | 'signup') => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === 'signin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        const local = email.split('@')[0] || 'New User';
        const name = local.charAt(0).toUpperCase() + local.slice(1);
        await register(name, email.trim(), password);
      }
      onClose();
      router.replace('/home');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : isLogin
            ? 'Could not sign you in. Please try again.'
            : 'Could not create your account. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080e11]/55 px-4 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-sm rounded-2xl border border-[#0f172a]/10 bg-[#ffffff] p-7 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-sm font-normal text-[#9295a3] transition-colors hover:text-[#0f1c22]"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-extrabold tracking-tight text-[#0f1c22]">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-1 text-xs text-[#6b6f80]">
            {isLogin ? 'Sign in to your account to continue' : 'Plan effortlessly in minutes.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#6b6f80]">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#e5e6ec] bg-[#fafafc] px-3.5 py-2.5 text-sm text-[#0f1c22] placeholder-[#a2a5b3] transition-all focus:border-[#e76f51] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6b6f80]">Password</label>
              {isLogin && (
                <a href="#" className="text-xs font-semibold text-[#e76f51] hover:underline">
                  Forgot?
                </a>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#e5e6ec] bg-[#fafafc] px-3.5 py-2.5 text-sm text-[#0f1c22] placeholder-[#a2a5b3] transition-all focus:border-[#e76f51] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-[#e76f51]/25 bg-[#e76f51]/8 px-3 py-2 text-xs text-[#6e220f]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-[#e76f51] py-2.5 text-sm font-bold text-[#ffffff] transition-all hover:bg-[#ec8b73] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6b6f80]">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(isLogin ? 'signup' : 'signin')}
            className="font-bold text-[#e76f51] hover:underline focus:outline-none"
          >
            {isLogin ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
