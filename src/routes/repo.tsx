import { Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import { EventFeed } from "../components/events.tsx";
import { ModeSwitch } from "../components/mode.tsx";
import { OnboardDialog } from "../components/onboard.tsx";
import { Pipeline } from "../components/pipeline.tsx";
import { OpenWorkList, ShipButton } from "../components/ship.tsx";
import { DeploymentsSection } from "../components/coolify.tsx";
import { BranchName, Button, Card, Empty, Skeleton } from "../components/ui.tsx";
import type { ApiRepo } from "../lib/api-types.ts";
import { ApiError } from "../lib/api.ts";
import { useMe, useRepo } from "../lib/queries.ts";

export function RepoPage() {
  const { owner, repo: name } = useParams({ strict: false }) as { owner: string; repo: string };
  const full = `${owner}/${name}`;
  const q = useRepo(full);
  const me = useMe();
  const isOwner = me.data?.role === "owner";

  if (q.isError && (q.error as ApiError).status === 404) {
    return (
      <Card>
        <Empty title={`Oche can't see ${full}`} action={<BackLink />}>
          Install the Oche app on that account or give it access to this repo, then refresh.
        </Empty>
      </Card>
    );
  }

  const repo = q.data?.repo;
  const status = q.data?.status;
  const syncPr = status?.openPromotions.find((p) => p.kind === "sync-staging");

  return (
    <div className="space-y-6">
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-[-0.02em]">
              <span className="font-normal text-muted">{owner}/</span>
              {name}
            </h1>
            {repo && (
              <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
                Open on GitHub <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          {repo?.managed && <ModeSwitch repo={repo} canEdit={isOwner} />}
        </div>
      </div>

      {!repo ? (
        <div className="grid gap-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !repo.managed ? (
        <NotManaged repo={repo} canSetUp={isOwner} />
      ) : (
        <>
          {syncPr && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/8 px-4 py-3 text-[13px]">
              <AlertTriangle className="size-4 shrink-0 text-danger" />
              <p className="min-w-0 flex-1">
                <span className="font-medium">{repo.branches!.staging} and {repo.branches!.prod} have drifted.</span>{" "}
                <span className="text-ink-2">Resolve the conflicts in #{syncPr.number} to bring them back in step.</span>
              </p>
              <a href={syncPr.url} target="_blank" rel="noreferrer" className="font-medium text-danger hover:underline">
                Open #{syncPr.number}
              </a>
            </div>
          )}

          <section aria-labelledby="pipeline" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="pipeline" className="text-[13px] font-medium text-muted">
                Pipeline
              </h2>
              <ShipButton repo={repo} status={status} disabled={!status} />
            </div>
            <Pipeline repo={repo} status={status} loading={q.isLoading || (q.isFetching && !status)} />
          </section>

          <DeploymentsSection repo={repo} />

          <OpenWorkList repo={repo} status={status} />

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <Card className="overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 text-[13px] font-medium">Activity</h2>
              <div className="lg:max-h-[560px] lg:overflow-y-auto">
                <EventFeed events={q.data?.events} loading={q.isLoading} />
              </div>
            </Card>
            <Rules repo={repo} />
          </div>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
      <ArrowLeft className="size-3.5" /> Projects
    </Link>
  );
}

function NotManaged({ repo, canSetUp }: { repo: ApiRepo; canSetUp: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Empty
        title="Oche isn't guarding this repo yet"
        action={
          canSetUp && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Set up {repo.name}
            </Button>
          )
        }
      >
        Setting it up creates staging and dev if they're missing, points new PRs at dev, and starts checking every PR against the flow.
      </Empty>
      <OnboardDialog repo={repo} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

/** The flow in plain words, so nobody has to remember it. */
function Rules({ repo }: { repo: ApiRepo }) {
  const b = repo.branches!;
  const strict = repo.mode === "strict";
  const approvals = `${repo.requiredApprovals} approval${repo.requiredApprovals === 1 ? "" : "s"}`;
  const rows: { from: React.ReactNode; to: React.ReactNode; note: string }[] = [
    { from: <span className="font-mono text-[12.5px] text-ink-2">any branch</span>, to: <BranchName name={b.dev} stage="dev" />, note: strict ? approvals : "no review" },
    { from: <BranchName name={b.dev} stage="dev" />, to: <BranchName name={b.staging} stage="staging" />, note: strict ? approvals : "one click" },
    { from: <BranchName name={b.staging} stage="staging" />, to: <BranchName name={b.prod} stage="prod" />, note: strict ? approvals : "one click" },
    { from: <BranchName name={b.dev} stage="dev" />, to: <BranchName name={b.prod} stage="prod" />, note: "staging synced after" },
  ];
  return (
    <Card className="self-start p-4">
      <h2 className="text-[13px] font-medium">How {repo.name} is guarded</h2>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px]">
            {r.from}
            <span className="text-muted">→</span>
            {r.to}
            <span className="ml-auto text-muted">{r.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
        Anything else aimed at {b.staging} or {b.prod} is moved to {b.dev} or closed. Deleted branches come back, and pushes straight to {b.prod}{" "}
        show up in the activity log.
      </p>
    </Card>
  );
}
