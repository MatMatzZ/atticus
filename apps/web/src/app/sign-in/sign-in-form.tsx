'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) setError(error.message);
      else setSent(true);
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) { setError(error.message); return; }
      router.replace('/');
      router.refresh();
    });
  }

  const input =
    'w-full rounded-lg border border-border bg-surface px-4 py-3 text-lg min-h-12';
  const button =
    'w-full rounded-lg bg-accent px-4 py-3 text-lg font-medium text-accent-contrast disabled:opacity-60';

  return sent ? (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-medium">Code sent to {email}</span>
        <input
          className={`${input} tracking-widest`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <button className={button} disabled={pending || code.length !== 6}>
        {pending ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" className="text-muted underline" onClick={() => { setSent(false); setCode(''); }}>
        Use a different email
      </button>
      {error && <p role="alert" className="text-urgent">{error}</p>}
    </form>
  ) : (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-medium">Email</span>
        <input
          className={input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button className={button} disabled={pending || !email}>
        {pending ? 'Sending…' : 'Email me a code'}
      </button>
      {error && <p role="alert" className="text-urgent">{error}</p>}
    </form>
  );
}
