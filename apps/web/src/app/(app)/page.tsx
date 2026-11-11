import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canWrite } from "@atticus/core";
import { BreathingChart } from "@/components/breathing-chart";
import { DashboardSkeleton } from "@/components/skeletons";
import { ACTIVITY_PAGE_SIZE, getActivityPage, getBreathingTrends, getDashboardData } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number.parseInt(String(rawPage ?? "1"), 10) || 1);

  const { households, pets } = await getDashboardData();
  if (pets.length === 0) {
    return <p className="text-muted">No pets yet. Create a household and add a pet in the mobile app.</p>;
  }
  const petIds = pets.map((p) => p.id);
  const [trends, activity] = await Promise.all([getBreathingTrends(petIds), getActivityPage(petIds, page)]);
  const petName = new Map(pets.map((p) => [p.id, p.name]));
  const tz = pets.length ? households.get(pets[0].household_id)?.timezone : undefined;
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: tz });

  return (
    <>
      {pets.map((pet) => {
        const household = households.get(pet.household_id)!;
        const thresholds = pet.pet_thresholds.filter((t) => t.metric === "rrr");
        return (
          <section key={pet.id} className="rounded-xl border border-border bg-surface p-5" aria-labelledby={`pet-${pet.id}`}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`pet-${pet.id}`} className="text-2xl font-semibold">
                {pet.name}
                {pet.status === "memorial" && <span className="ml-2 text-base font-normal text-muted">In memory</span>}
              </h2>
              <span className="text-sm text-muted">
                {household.name} · {household.role}
                {!canWrite(household.role) && " · read-only"}
              </span>
            </div>
            <h3 className="mb-2 font-medium">Breathing rate · last 14 days</h3>
            <BreathingChart points={trends[pet.id] ?? []} thresholds={thresholds} />
          </section>
        );
      })}

      <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="activity">
        <h2 id="activity" className="mb-4 text-2xl font-semibold">Recent activity</h2>
        {activity.rows.length === 0 ? (
          <p className="text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.rows.map((r) => (
              <li key={`${r.type}-${r.id}`} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  <span className={r.type === "urgent" ? "font-semibold text-urgent" : "font-medium"}>
                    {r.type === "urgent" && "URGENT · "}
                    {r.title}
                  </span>
                  <span className="text-muted"> · {petName.get(r.pet_id)}{r.detail ? ` · ${r.detail}` : ""}</span>
                </span>
                <time className="text-sm text-muted" dateTime={r.occurred_at}>{fmt.format(new Date(r.occurred_at))}</time>
              </li>
            ))}
          </ul>
        )}
        <nav className="mt-4 flex justify-between" aria-label="Activity pages">
          {page > 1 ? (
            <Link className="flex items-center px-2 underline" href={page === 2 ? "/" : `/?page=${page - 1}`}>← Newer</Link>
          ) : <span />}
          {activity.hasNext && (
            <Link className="flex items-center px-2 underline" href={`/?page=${page + 1}`}>Older →</Link>
          )}
        </nav>
        <p className="sr-only">Page {page}, {ACTIVITY_PAGE_SIZE} items per page</p>
      </section>
    </>
  );
}
