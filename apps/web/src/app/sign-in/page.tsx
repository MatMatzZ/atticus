import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold">ATTICUS</h1>
        <p className="mt-2 text-muted">
          Sign in with your email. We&apos;ll send you a 6-digit code.
        </p>
      </header>
      <SignInForm />
      <p className="text-sm text-muted">
        ATTICUS records and organizes your pet&apos;s care. It does not diagnose or give
        medical advice — follow your licensed veterinarian.
      </p>
    </main>
  );
}
