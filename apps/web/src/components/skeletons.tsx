export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      {[0, 1].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
      ))}
      <div className="h-80 animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}
