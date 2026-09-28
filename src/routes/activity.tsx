import { EventFeed } from "../components/events.tsx";
import { Card, Select } from "../components/ui.tsx";
import { useEvents, useRepos } from "../lib/queries.ts";
import { useState } from "react";

/** "owner/repo" can't contain a space, so this can't collide with a repo. */
const ALL = "all repos";

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
        <Select
          value={repo || ALL}
          onChange={(v) => setRepo(v === ALL ? "" : v)}
          className="w-auto max-w-72 min-w-44"
          aria-label="Filter by repo"
          options={[{ value: ALL, label: "All repos" }, ...managed.map((r) => ({ value: r.fullName, label: r.fullName }))]}
        />
      </div>
      <Card className="overflow-hidden">
        <EventFeed events={events.data?.events} loading={events.isLoading} showRepo={!repo} />
      </Card>
    </div>
  );
}
