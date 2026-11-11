'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-surface p-6">
      <p className="font-medium">Something went wrong loading your pets.</p>
      <button className="mt-4 rounded-lg bg-accent px-4 text-accent-contrast" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
