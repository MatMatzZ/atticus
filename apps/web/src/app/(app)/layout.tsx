import { signOut } from './actions';

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="text-2xl font-semibold">ATTICUS</span>
        <form action={signOut}>
          <button className="rounded-lg border border-border px-4 text-muted">Sign out</button>
        </form>
      </header>
      {children}
    </div>
  );
}
