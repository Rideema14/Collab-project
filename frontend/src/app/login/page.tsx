'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Don't make them log in twice.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/projects');
    }
  }, [status, router]);

  /** Client-side validation is for *fast feedback* only — the server re-validates. */
  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/projects');
    } catch (error) {
      /*
       * The backend answers 401 "Invalid email or password" for both a missing
       * user and a wrong password — deliberately, so it doesn't leak which
       * emails are registered. We surface its message verbatim and don't try to
       * be more specific than the server was willing to be.
       */
      setFormError(
        error instanceof ApiError ? error.message : 'Could not sign you in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Pick up where your team left off."
      footer={{ prompt: 'New here?', linkText: 'Create an account', href: '/register' }}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            {formError}
          </div>
        )}

        <Field label="Email" error={fieldErrors.email} required>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <Field label="Password" error={fieldErrors.password} required>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        {/* `loading` disables the button — the double-submit guard. */}
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
