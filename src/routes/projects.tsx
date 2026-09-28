import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import clsx from "clsx";
import { AlertTriangle, Lock, Plus, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OnboardDialog } from "../components/onboard.tsx";
import { PipelineStrip } from "../components/pipeline.tsx";
import { Avatar, Badge, Button, Card, Empty, githubAvatar, LinkButton, Skeleton } from "../components/ui.tsx";
import type { ApiRepo } from "../lib/api-types.ts";
import { useInstallations, useMe, useRefreshRepos, useRepo, useRepos } from "../lib/queries.ts";

const PREVIEW = 8;

export function ProjectsPage() {
  const repos = useRepos();
  const installs = useInstallations();
  const refresh = useRefreshRepos();
  const me = useMe();
  const search = useSearch({ strict: false }) as { installed?: string };
  const navigate = useNavigate();
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    if (search.installed) {
      toast.success("Oche is installed", { description: "Pick a repo below to set it up." });
      void navigate({ to: "/", search: {}, replace: true });
    }
  }, [search.installed, navigate]);

  const all = repos.data?.repos ?? [];
  const accounts = useMemo(() => [...new Set(all.map((r) => r.owner))], [all]);
  const visible = account ? all.filter((r) => r.owner === account) : all;
  const guarded = visible.filter((r) => r.managed);
  const notSetUp = visible.filter((r) => !r.managed);
  const isOwner = me.data?.role === "owner";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Projects</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {repos.isLoading ? "Loading…" : `${all.filter((r) => r.managed).length} guarded across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            loading={refresh.isPending}
            onClick={() => refresh.mutate(undefined, { onError: (e) => toast.error("Refresh failed", { description: e.message }) })}
          >
            {!refresh.isPending && <RefreshCw className="size-3.5" />} Refresh
          </Button>
          {installs.data?.installUrl && (
            <LinkButton href={installs.data.installUrl} target="_blank" rel="noreferrer" size="sm">
              <Plus className="size-3.5" /> Add account or org
            </LinkButton>
          )}
        </div>
      </div>

      {accounts.length > 1 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter by account">
          {[null, ...accounts].map((a) => (
            <button
              key={a ?? "all"}
              role="tab"
              aria-selected={account === a}
              onClick={() => setAccount(a)}
              className={clsx(
                "pressable inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium",
                account === a ? "bg-ink text-bg" : "bg-surface text-ink-2 shadow-card hover:bg-surface-2",
              )}
            >
              {a && <Avatar src={githubAvatar(a)} alt={a} size={14} />}
              {a ?? "All"}
            </button>
          ))}
        </div>
      )}

      {repos.isLoading ? (
        <Card className="divide-y divide-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-6 w-56" />
            </div>
          ))}
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <Empty
            title="No repos yet"
            action={
              installs.data?.installUrl && (
                <LinkButton href={installs.data.installUrl} target="_blank" rel="noreferrer" variant="primary">
                  Install on GitHub
                </LinkButton>
              )
            }
          >
            {isOwner
              ? "Install Oche on your GitHub account or an org and pick the repos it should look after."
              : "You'll see a repo here once you have access to it on GitHub and Oche is installed on its account. Press Refresh after you've been added."}
          </Empty>
        </Card>
      ) : (
        <>
          <section aria-labelledby="guarded">
            <h2 id="guarded" className="mb-2 text-[13px] font-medium text-muted">
              Guarded
            </h2>
            {guarded.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {guarded.map((r, i) => (
                  <GuardedRow key={r.id} repo={r} index={i} />
                ))}
              </Card>
            ) : (
              <Card>
                <Empty title="Nothing guarded yet">Set up a repo below. It takes one click.</Empty>
              </Card>
            )}
          </section>

          {notSetUp.length > 0 && <NotSetUp repos={notSetUp} canSetUp={isOwner} />}
        </>
      )}
    </div>
  );
}

function GuardedRow({ repo, index }: { repo: ApiRepo; index: number }) {
  const detail = useRepo(repo.fullName);
  const status = detail.data?.status;
  const syncConflict = status?.openPromotions.some((p) => p.kind === "sync-staging");
  const waiting = status?.openPromotions.filter((p) => p.kind !== "sync-staging").length ?? 0;

  return (
    <div className="enter hoverable relative flex flex-col gap-2.5 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-4" style={{ "--i": index } as React.CSSProperties}>
      <Link
        to="/$owner/$repo"
        params={{ owner: repo.owner, repo: repo.name }}
        className="flex min-w-0 items-center gap-2.5 after:absolute after:inset-0 after:content-['']"
      >
        <Avatar src={githubAvatar(repo.owner)} alt={repo.owner} size={24} className="rounded-md" />
        <span className="min-w-0 truncate text-[14px]">
          <span className="text-muted">{repo.owner}/</span>
          <span className="font-medium">{repo.name}</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5 lg:flex-1">
        <Badge tone={repo.mode === "strict" ? "ember" : "neutral"}>{repo.mode === "strict" ? "Strict" : "Fast"}</Badge>
        {syncConflict && (
          <Badge tone="danger">
            <AlertTriangle className="size-3" /> Sync conflict
          </Badge>
        )}
        {waiting > 0 && <Badge tone="warn">{waiting} awaiting review</Badge>}
      </div>
      <div className="relative z-[1] -ml-1.5 lg:ml-0">
        <PipelineStrip repo={repo} status={status} loading={detail.isLoading} />
      </div>
    </div>
  );
}

function NotSetUp({ repos, canSetUp }: { repos: ApiRepo[]; canSetUp: boolean }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [target, setTarget] = useState<ApiRepo | null>(null);
  const filtered = repos.filter((r) => r.fullName.toLowerCase().includes(query.toLowerCase()));
  const shown = showAll || query ? filtered : filtered.slice(0, PREVIEW);

  return (
    <section aria-labelledby="not-set-up">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="not-set-up" className="text-[13px] font-medium text-muted">
          Not set up <span className="tabular-nums">({repos.length})</span>
        </h2>
        <label className="flex h-8 w-full max-w-60 items-center gap-2 field rounded-lg bg-surface px-2.5">
          <Search className="size-3.5 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter repos"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted"
            aria-label="Filter repos"
          />
        </label>
      </div>
      <Card className="divide-y divide-line overflow-hidden">
        {shown.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13.5px]">
              <span className="text-muted">{r.owner}/</span>
              {r.name}
            </span>
            {r.private && <Lock className="size-3.5 shrink-0 text-muted" aria-label="Private" />}
            {canSetUp && (
              <Button size="sm" onClick={() => setTarget(r)}>
                Set up
              </Button>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted">No repos match "{query}".</p>}
      </Card>
      {!showAll && !query && filtered.length > PREVIEW && (
        <button onClick={() => setShowAll(true)} className="mt-2 text-[13px] font-medium text-ink-2 hover:text-ink">
          Show all {filtered.length}
        </button>
      )}
      {target && <OnboardDialog repo={target} open onOpenChange={(o) => !o && setTarget(null)} />}
    </section>
  );
}
