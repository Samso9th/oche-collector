import { EventFeed } from "../components/events.tsx";
import { Card } from "../components/ui.tsx";
import { useEvents, useRepos } from "../lib/queries.ts";
import { useState } from "react";

export function ActivityPage() {
  const repos = useRepos();
  const [repo, setRepo] = useState("");
  const events = useEvents(repo || undefined);
  const managed = repos.data?.repos.filter((r) => r.managed) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Activity</h1>
          <p className="mt-0.5 text-[13px] text-muted">Everything Oche did or caught, newest first.</p>
        </div>
        <select
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="h-8 field rounded-lg bg-surface px-2.5 text-[13px] outline-none"
          aria-label="Filter by repo"
        >
          <option value="">All repos</option>
          {managed.map((r) => (
            <option key={r.id} value={r.fullName}>
              {r.fullName}
            </option>
          ))}
        </select>
      </div>
      <Card className="overflow-hidden">
        <EventFeed events={events.data?.events} loading={events.isLoading} showRepo={!repo} />
      </Card>
    </div>
  );
}
