'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api/client';

export default function KuberyaLandingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Already signed in? Skip the landing page and go straight to the app.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/home');
  }, [status, router]);

  const openModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <main className="cosmic-auth relative min-h-dvh w-full overflow-hidden bg-[#05070d] text-white font-sans">
      <CosmicBackdrop />

      {/* Navigation */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <BrandMark />

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#views" className="hover:text-white transition-colors">Views</Link>
          <Link href="#collaboration" className="hover:text-white transition-colors">Real-time</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>

        {/* Nav CTAs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => openModal('signin')}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/10"
          >
            Sign In
          </button>
          <button
            onClick={() => openModal('signup')}
            className="rounded-full bg-gradient-to-r from-[#818cf8] to-[#a78bfa] px-5 py-2 text-sm font-bold text-white shadow-[0_4px_20px_rgba(129,140,248,0.3)] transition-all hover:shadow-[0_4px_30px_rgba(129,140,248,0.5)] hover:scale-105"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Centered Hero Section */}
      <section className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-6 text-center lg:px-8">
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
          Plan your team&rsquo;s work <br />
          <span className="bg-gradient-to-r from-[#a78bfa] via-[#818cf8] to-[#22d3ee] bg-clip-text text-transparent">
            effortlessly.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
          Kuberya keeps every task, status, and deadline on one calm, shared board — so nothing slips through the cracks.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <button
            onClick={() => openModal('signup')}
            className="group flex items-center justify-center rounded-full bg-gradient-to-r from-[#818cf8] to-[#a78bfa] px-8 py-3.5 text-base font-bold text-white shadow-[0_4px_30px_rgba(129,140,248,0.35)] transition-all hover:shadow-[0_4px_40px_rgba(129,140,248,0.55)] hover:scale-105"
          >
            Start Free
          </button>
          <button className="flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10">
            Watch Demo
          </button>
        </div>
      </section>

      {/* Interactive Mockup Task Board Peek */}
      <div className="relative z-10 mx-auto mt-12 max-w-5xl px-6 lg:mt-16">
        <div className="w-full rounded-t-3xl border border-white/10 bg-[#0c0f19]/90 p-4 backdrop-blur-xl shadow-[0_-20px_50px_-15px_rgba(129,140,248,0.25)]">
          {/* Mockup Top Header / Chrome controls */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#eab308]/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#22c55e]/60" />
              <span className="ml-4 text-xs font-semibold tracking-wider text-white/30 uppercase">Workspace / Project Board</span>
            </div>
            {/* Action buttons mimicking actual software UI */}
            <div className="flex items-center gap-2">
              <span className="rounded bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/50">Board View</span>
              <span className="rounded px-2.5 py-1 text-[10px] font-medium text-white/30 hover:bg-white/5 cursor-pointer">Timeline</span>
              <span className="rounded px-2.5 py-1 text-[10px] font-medium text-white/30 hover:bg-white/5 cursor-pointer">Calendar</span>
            </div>
          </div>

          {/* Real Live Kanban Board Columns */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Column 1: Backlog */}
            <div className="rounded-xl bg-white/[0.02] p-3 border border-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white/60 tracking-wide uppercase">Backlog</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">3</span>
              </div>
              <div className="space-y-2.5">
                <TaskCard
                  title="Refactor core cosmic auth engine"
                  tag="Tech Debt"
                  tagColor="border-amber-500/20 text-amber-400 bg-amber-500/5"
                  avatarInitials="JS"
                  progress={65}
                />
                <TaskCard
                  title="Set up shared responsive variables"
                  tag="Setup"
                  tagColor="border-cyan-500/20 text-cyan-400 bg-cyan-500/5"
                  avatarInitials="AW"
                />
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div className="rounded-xl bg-white/[0.02] p-3 border border-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">In Progress</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">1</span>
              </div>
              <div className="space-y-2.5">
                <TaskCard
                  title="Design stunning glassmorphic UI elements"
                  tag="Design"
                  tagColor="border-indigo-500/20 text-indigo-400 bg-indigo-500/5"
                  avatarInitials="KB"
                  progress={90}
                />
              </div>
            </div>

            {/* Column 3: Done */}
            <div className="rounded-xl bg-white/[0.02] p-3 border border-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">Completed</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">2</span>
              </div>
              <div className="space-y-2.5 opacity-60">
                <TaskCard
                  title="Migrate asset configurations to CSS/SVG"
                  tag="Production"
                  tagColor="border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                  avatarInitials="JD"
                  progress={100}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pop-up Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </main>
  );
}

// ==========================================
// REUSABLE TASK CARD COMPONENT
// ==========================================
function TaskCard({
  title,
  tag,
  tagColor,
  avatarInitials,
  progress
}: {
  title: string;
  tag: string;
  tagColor: string;
  avatarInitials: string;
  progress?: number;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0f1424] p-3.5 shadow-sm hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-wide ${tagColor}`}>
          {tag}
        </span>
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white/80">
          {avatarInitials}
        </div>
      </div>
      <p className="text-xs font-medium text-white/85 leading-normal">{title}</p>

      {progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] text-white/40 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#818cf8] to-[#a78bfa] rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// KUBERYA BRAND MARK
// ==========================================
function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl shadow-[0_6px_24px_-6px_rgba(99,102,241,0.7)] bg-gradient-to-tr from-[#6366f1] to-[#a855f7]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" transform="rotate(-30 12 12)" />
          <circle cx="12" cy="12" r="3" fill="white" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">Kuberya</span>
    </div>
  );
}

// ==========================================
// COSMIC BACKGROUND
// ==========================================
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
      {/* diagonal light beam */}
      <div
        className="absolute -left-1/4 -top-1/3 h-[150%] w-[55%] rotate-[20deg] blur-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(130,170,255,0.25), transparent 60%)' }}
      />
      {/* starfield */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 10% 20%, rgba(255,255,255,0.95), transparent),' +
            'radial-gradient(1.5px 1.5px at 70% 14%, rgba(255,255,255,0.8), transparent),' +
            'radial-gradient(2px 2px at 32% 60%, #fff, transparent),' +
            'radial-gradient(1px 1px at 85% 48%, rgba(255,255,255,0.7), transparent),' +
            'radial-gradient(1.5px 1.5px at 52% 82%, rgba(255,255,255,0.85), transparent),' +
            'radial-gradient(1px 1px at 20% 92%, rgba(255,255,255,0.6), transparent)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      />
      {/* bottom glowing planet curve */}
      <div
        className="absolute -bottom-48 left-1/2 h-[26rem] w-[46rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.35), rgba(59,130,246,0.15) 42%, transparent 70%)',
        }}
      />
      <div className="absolute -bottom-[40rem] left-1/2 h-[54rem] w-[54rem] -translate-x-1/2 rounded-full border border-white/[0.06]" />
    </div>
  );
}

// ==========================================
// GLASSMORPHIC POPUP MODAL
// ==========================================
function AuthModal({
  mode,
  setMode,
  onClose
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
        // The compact modal has no name field, so seed the display name from the
        // email's local part (e.g. "priya@acme.com" → "Priya"). The server needs one.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm transition-opacity duration-200">
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0f19]/95 p-7 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-lg font-light text-white/40 hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-1.5 text-sm text-white/55">
            {isLogin ? 'Sign in to your account to continue' : 'Plan effortlessly in minutes.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/75">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/30 transition-all focus:border-[#818cf8] focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#818cf8]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/75">Password</label>
              {isLogin && (
                <a href="#" className="text-xs font-medium text-[#93b4ff] hover:text-white hover:underline">
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
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/30 transition-all focus:border-[#818cf8] focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#818cf8]/20"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[#fb7185]/30 bg-[#fb7185]/10 px-3 py-2 text-sm text-[#fda4af]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#818cf8] to-[#a78bfa] py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(129,140,248,0.5)] transition-all hover:opacity-95 hover:shadow-[0_4px_24px_-2px_rgba(129,140,248,0.65)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setMode(isLogin ? 'signup' : 'signin')}
            className="font-medium text-[#93b4ff] hover:text-white hover:underline focus:outline-none"
          >
            {isLogin ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
