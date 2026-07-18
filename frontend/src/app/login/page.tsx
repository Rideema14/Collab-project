'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, MessageSquare, Box, CalendarDays, ChevronDown, Menu, Video } from 'lucide-react';
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
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#b3cc33] font-sans text-[#141807]">
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
            className="rounded-full border border-[#141807]/25 bg-[#141807]/10 px-6 py-2.5 text-xs font-bold text-[#141807] backdrop-blur-md transition-all hover:bg-[#141807]/20"
          >
            Login
          </button>
        </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-14 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:gap-8 lg:px-14 lg:py-0 xl:px-20">
        {/* ==========================================
            LEFT: Brand copy
           ========================================== */}
        <div className="flex w-full flex-col gap-10 lg:w-[42%] lg:shrink-0">
          <div>
            <h1 className="text-[2.6rem] font-black leading-[1.04] tracking-tight sm:text-6xl xl:text-[4rem]">
              Plan &amp; Meet
              <br />
              with Kuberya.
            </h1>

            <ul className="mt-8 flex flex-col gap-4">
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

            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={() => openModal('signup')}
                className="rounded-full bg-[#ffffff] px-8 py-3.5 text-sm font-extrabold text-[#5f7216] shadow-[0_16px_32px_-10px_rgba(0,0,0,0.35)] transition-all hover:scale-105"
              >
                Start Free
              </button>
            </div>
          </div>

          {/* Integration badges */}
          <div className="mt-2 flex items-center gap-3">
            <ToolBadge>
              <Video size={18} color="#5f7216" strokeWidth={1.8} />
            </ToolBadge>
            <ToolBadge>
              <CalendarDays size={18} color="#0f1c22" strokeWidth={1.8} />
            </ToolBadge>
            <ToolBadge>
              <MessageSquare size={18} color="#5f7216" strokeWidth={1.8} />
            </ToolBadge>
          </div>
        </div>

        {/* ==========================================
            RIGHT: Device showcase
           ========================================== */}
        <div className="relative w-full flex-1 lg:h-full">
          <div className="relative mx-auto flex w-full max-w-[760px] items-center justify-center py-4 lg:absolute lg:inset-y-0 lg:right-[-6%] lg:mx-0 lg:max-w-none lg:justify-end xl:right-[-10%]">
            {/* Laptop */}
            <div className="relative w-full max-w-[680px] xl:max-w-[760px]">
              <div className="overflow-hidden rounded-t-[1.25rem] border-[10px] border-b-0 border-[#0f1c22] bg-[#0f1c22] shadow-[0_40px_80px_-24px_rgba(20,8,0,0.45)]">
                <div className="relative flex h-6 items-center justify-center">
                  <span className="h-3 w-14 rounded-full bg-[#080e11]" />
                  <span className="absolute h-1 w-1 rounded-full bg-[#3a3a42]" />
                </div>
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#fbfbfc]">
                  <ConnectorLines variant="laptop" />

                  <div className="relative flex h-full flex-col p-5 sm:p-8">
                    <div className="mb-6 flex items-center justify-between border-b border-[#eeeef1] pb-4">
                      <BrandMarkDark />
                      <div className="hidden items-center gap-6 text-[11px] font-bold text-[#8a8b93] sm:flex">
                        <span className="flex items-center gap-1 text-[#0f1c22]">
                          Product <ChevronDown size={12} />
                        </span>
                        <span>Boards</span>
                        <span>Meetings</span>
                        <span>Integrations</span>
                        <span>Developers</span>
                      </div>
                      <Menu size={16} className="text-[#0f1c22] sm:hidden" />
                    </div>

                    <div className="relative z-10 mt-2 max-w-md lg:ml-[14%]">
                      <h2 className="text-2xl font-black leading-[1.08] tracking-tight text-[#0f1c22] sm:text-[2rem]">
                        Create, inspect, and
                        <br />
                        synthetic surveillance
                      </h2>
                      <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-[#9497a1]">
                        Start with a stunning homepage. Stay motivated without hurting your pocket.
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-6">
                      <p className="text-[10px] font-semibold text-[#9497a1]">
                        Want to talk or get a live demo? <span className="text-[#5f7216]">Get in touch →</span>
                      </p>
                      <button className="rounded-full bg-[#b3cc33] px-5 py-2 text-[11px] font-bold text-[#141807] shadow-sm">
                        Start for free
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* base wedge */}
              <div className="mx-auto h-3.5 w-[105%] max-w-none -translate-x-[2.5%] rounded-b-[4px] bg-[#0f1c22]" />
              <div className="mx-auto h-1 w-[70%] rounded-b-xl bg-[#0f1c22]/80" />
            </div>

            {/* Phone, overlapping only the laptop's blank left margin — not its headline */}
            <div className="absolute left-0 top-[38%] z-10 hidden w-28 rotate-[-14deg] sm:block sm:w-32 md:w-36 lg:left-[-15%] lg:w-44 xl:left-[-17%] xl:w-48">
              <div className="overflow-hidden rounded-[2.2rem] border-[8px] border-[#0f1c22] bg-[#fbfbfc] shadow-[-18px_28px_50px_-14px_rgba(20,8,0,0.5)]">
                <div className="relative flex justify-center py-1.5">
                  <span className="h-2.5 w-14 rounded-full bg-[#0f1c22]" />
                </div>
                <div className="relative aspect-[9/18.3] w-full overflow-hidden bg-[#fbfbfc]">
                  <ConnectorLines variant="phone" />

                  <div className="relative flex h-full flex-col p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <BrandMarkDark small />
                      <Menu size={12} className="text-[#0f1c22]" />
                    </div>

                    <h3 className="text-[13px] font-black leading-snug tracking-tight text-[#0f1c22]">
                      Create, inspect, and apply synthetic surveillance broadly.
                    </h3>
                    <p className="mt-2 text-[9px] leading-relaxed text-[#9497a1]">
                      Start with a stunning homepage. Stay motivated without hurting your pocket.
                    </p>

                    <button className="mt-3 w-fit rounded-full bg-[#b3cc33] px-3.5 py-1.5 text-[9px] font-bold text-[#141807]">
                      Start for free
                    </button>

                    <p className="mt-auto pb-2 text-[8px] font-semibold text-[#9497a1]">
                      Want a live demo? <span className="text-[#5f7216]">Get in touch →</span>
                    </p>
                  </div>
                </div>
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
function CubeGlyph({ stroke = '#ffffff', size = 20 }: { stroke?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 21 7v10l-9 5-9-5V7Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7 12 12l9-5M12 12v10" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <CubeGlyph size={26} stroke="#141807" />
      <span className="text-lg font-extrabold tracking-tight text-[#141807]">Kuberya</span>
    </div>
  );
}

function BrandMarkDark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <CubeGlyph stroke="#0f1c22" size={small ? 14 : 16} />
      <span className={`font-extrabold tracking-tight text-[#0f1c22] ${small ? 'text-[9px]' : 'text-xs'}`}>Kuberya</span>
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
// DECORATIVE CONNECTOR-LINE NODE CLUSTER (inside device screens)
// ==========================================
function ConnectorLines({ variant }: { variant: 'laptop' | 'phone' }) {
  const nodes =
    variant === 'laptop'
      ? [
          { x: 68, y: 28, size: 34, bg: '#0f1c22', Icon: Flag },
          { x: 86, y: 46, size: 46, bg: '#5f7216', Icon: Box },
          { x: 64, y: 64, size: 28, bg: '#0f1c22', Icon: MessageSquare },
        ]
      : [
          { x: 22, y: 66, size: 22, bg: '#0f1c22', Icon: Flag },
          { x: 46, y: 76, size: 28, bg: '#5f7216', Icon: Box },
          { x: 70, y: 66, size: 20, bg: '#0f1c22', Icon: CalendarDays },
        ];

  return (
    <div
      className={`pointer-events-none absolute inset-0 hidden h-full w-full opacity-90 ${variant === 'laptop' ? 'sm:block' : 'lg:block'}`}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.map((n, i) =>
          nodes.slice(i + 1).map((m, j) => (
            <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#5f7216" strokeWidth="0.25" strokeOpacity="0.35" />
          ))
        )}
        {nodes.map((n, i) => (
          <line key={`edge-${i}`} x1={n.x} y1={n.y} x2="100" y2={Math.max(0, n.y - 12)} stroke="#5f7216" strokeWidth="0.2" strokeOpacity="0.22" />
        ))}
      </svg>
      {nodes.map((n, i) => (
        <span
          key={i}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl shadow-[0_10px_18px_-8px_rgba(0,0,0,0.35)]"
          style={{ left: `${n.x}%`, top: `${n.y}%`, width: n.size, height: n.size, backgroundColor: n.bg }}
        >
          <n.Icon size={Math.round(n.size * 0.46)} color="#ffffff" strokeWidth={2.25} />
        </span>
      ))}
    </div>
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
              className="w-full rounded-xl border border-[#e5e6ec] bg-[#fafafc] px-3.5 py-2.5 text-sm text-[#0f1c22] placeholder-[#a2a5b3] transition-all focus:border-[#5f7216] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6b6f80]">Password</label>
              {isLogin && (
                <a href="#" className="text-xs font-semibold text-[#5f7216] hover:underline">
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
              className="w-full rounded-xl border border-[#e5e6ec] bg-[#fafafc] px-3.5 py-2.5 text-sm text-[#0f1c22] placeholder-[#a2a5b3] transition-all focus:border-[#5f7216] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-[#c39516]/30 bg-[#f5c518]/15 px-3 py-2 text-xs text-[#5c470a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-[#b3cc33] py-2.5 text-sm font-bold text-[#141807] transition-all hover:bg-[#a8be22] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6b6f80]">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(isLogin ? 'signup' : 'signin')}
            className="font-bold text-[#5f7216] hover:underline focus:outline-none"
          >
            {isLogin ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
