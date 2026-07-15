'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

/** Mirrors auth.service.js — the server rejects anything shorter. */
const MIN_PASSWORD_LENGTH = 6;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, status } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
    }
  }, [status, router]);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Enter your full name.';
    if (!email.trim()) errors.email = 'Enter your email address.';
    if (!password) {
      errors.password = 'Choose a password.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/home');
    } catch (error) {
      // 409 "An account with this email already exists" belongs on the email
      // field, not in a vague banner at the top of the form.
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: error.message });
      } else {
        setFormError(
          error instanceof ApiError
            ? error.message
            : 'Could not create your account. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Set up your profile to start planning work with your team."
      footer={{ prompt: 'Already have an account?', linkText: 'Sign in', href: '/login' }}
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

        <Field label="Full name" error={fieldErrors.name} required>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              invalid={invalid}
              name="name"
              autoComplete="name"
              placeholder="Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

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

        <Field
          label="Password"
          error={fieldErrors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          required
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          className="mt-1 border-0 bg-gradient-brand shadow-glow transition-opacity hover:opacity-90"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
