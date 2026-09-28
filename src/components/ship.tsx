import clsx from "clsx";
import { AlertTriangle, ArrowRight, Check, CircleX, ExternalLink, GitPullRequest, Loader2, Minus, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, ApiShipRun, OpenWork, RepoStatus, RunStep, ShipRequest } from "../lib/api-types.ts";
import { useCancelRun, usePreflight, useRecentRuns, useShipRun, useStartShip } from "../lib/queries.ts";
import { ago } from "../lib/time.ts";
import { Avatar, Badge, BranchName, Button, Card, Dialog, githubAvatar } from "./ui.tsx";

const MERGE_WORDS = { merge: "merge the PR", squash: "squash-merge the PR", rebase: "rebase-merge the PR" } as const;

/** The same plan the server makes (server/src/services/ship-runs.ts planSteps), for showing before anything runs. */
function plannedSteps(repo: ApiRepo, status: RepoStatus | null | undefined, req: ShipRequest) {
  const b = repo.branches!;
  const fromWork = req.from && req.from !== b.dev;
  const steps: { kind: "merge" | "wait"; label: string; head?: string; base?: string; note?: string }[] = [];
  if (fromWork) steps.push({ kind: "merge", head: req.from, base: b.dev, label: `${req.from} → ${b.dev}`, note: MERGE_WORDS[repo.workMergeMethod] });
  steps.push({ kind: "merge", head: b.dev, base: b.staging, label: `${b.dev} → ${b.staging}`, note: fromWork ? undefined : commits(status?.pending.staging) });
  if (repo.coolifyLinked && repo.gateOnStaging) steps.push({ kind: "wait", label: "Wait for staging to deploy and pass its health check" });
  steps.push({ kind: "merge", head: b.staging, base: b.prod, label: `${b.staging} → ${b.prod}`, note: fromWork ? undefined : commits(status?.pending.prod) });
  if (repo.coolifyLinked) steps.push({ kind: "wait", label: "Wait for production to deploy and pass its health check" });
  return steps;
}

const commits = (n: number | undefined) => (n === undefined ? undefined : n === 0 ? "up to date" : `${n} commit${n === 1 ? "" : "s"}`);

/** One confirmation, then every hop to production. Stays open to follow the run. */
export function ShipDialog({
  repo,
  status,
  from,
  runId: initialRun = null,
  open,
  onOpenChange,
}: {
  repo: ApiRepo;
  status: RepoStatus | null | undefined;
  from?: string;
  runId?: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const start = useStartShip(repo.fullName);
  const [runId, setRunId] = useState<number | null>(initialRun);
  const run = useShipRun(runId, repo.fullName);
  const preflight = usePreflight(repo.fullName, "prod", open && runId === null && repo.coolifyLinked);
  const cancel = useCancelRun();
  const announced = useRef<number | null>(null);
  const current = run.data?.run;

  useEffect(() => {
    if (!current || current.status === "running" || announced.current === current.id) return;
    announced.current = current.id;
    const failed = current.steps.find((s) => s.status === "failed" || s.status === "waiting-review");
    if (current.status === "succeeded") toast.success(`Shipped ${repo.name} to production`, { description: repo.coolifyLinked ? "Deployed and healthy." : undefined });
    else if (current.status === "cancelled") toast(`Ship cancelled`);
    else toast.error(`Stopped at ${failed?.label ?? "a step"}`, { description: failed?.detail });
  }, [current, repo.name, repo.coolifyLinked]);

  const go = () =>
    start.mutate(
      { from, to: "prod" },
      {
        onSuccess: ({ run }) => setRunId(run.id),
        onError: (e) => toast.error("Couldn't start the ship", { description: e.message }),
      },
    );

  const pf = preflight.data;
  const warnings = pf
    ? [
        ...pf.envIssues.flatMap((i) => [
          ...(i.missing.length ? [`${i.app} in production is missing ${list(i.missing)}.`] : []),
          ...(i.shared.length ? [`${i.app} uses the same ${list(i.shared)} in staging and production.`] : []),
        ]),
        ...(pf.below?.unhealthy.length ? [`Staging isn't healthy right now: ${pf.below.unhealthy.map((u) => u.name).join(", ")}.`] : []),
      ]
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={current ? shipTitle(current, repo) : `Ship ${from ?? repo.branches!.dev} to production?`}
      description={
        current
          ? `Started by ${current.actor} ${ago(current.createdAt)}. You can close this; it keeps running.`
          : repo.mode === "strict"
            ? `Strict mode: Oche stops at the first step without ${repo.requiredApprovals} approval${repo.requiredApprovals === 1 ? "" : "s"}.`
            : repo.coolifyLinked && repo.gateOnStaging
              ? "Production only moves once staging is deployed and healthy."
              : "Oche runs these in order and stops if one can't finish."
      }
    >
      {current ? (
        <RunSteps run={current} />
      ) : (
        <>
          <ol className="space-y-1.5">
            {plannedSteps(repo, status, { from, to: "prod" }).map((s, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-medium text-muted shadow-card">{i + 1}</span>
                {s.kind === "merge" ? (
                  <>
                    <BranchName name={s.head!} />
                    <ArrowRight className="size-3.5 text-muted" aria-hidden />
                    <BranchName name={s.base!} />
                  </>
                ) : (
                  <span className="text-ink-2">{s.label}</span>
                )}
                {s.note && <span className="ml-auto text-[12px] text-muted">{s.note}</span>}
              </li>
            ))}
          </ol>
          {preflight.isLoading && repo.coolifyLinked && (
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
              <Loader2 className="size-3 animate-spin" /> Checking environment variables and staging…
            </p>
          )}
          {warnings.length > 0 && (
            <div className="mt-3 rounded-lg bg-staging/12 px-3 py-2.5 text-[12.5px] text-ink-2">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-3.5 text-staging" /> Before you ship
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="mt-5 flex justify-end gap-2">
        {current?.status === "running" ? (
          <>
            <Button variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(current.id)}>
              Cancel ship
            </Button>
            <Button onClick={() => onOpenChange(false)}>Hide</Button>
          </>
        ) : current ? (
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={go} loading={start.isPending} autoFocus>
              <Rocket className="size-3.5" /> {warnings.length ? "Ship anyway" : "Ship to production"}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}

const list = (keys: string[]) => (keys.length <= 3 ? keys.join(", ") : `${keys.slice(0, 3).join(", ")} and ${keys.length - 3} more`);

function shipTitle(run: ApiShipRun, repo: ApiRepo) {
  const what = `${run.request.from ?? repo.branches!.dev} → production`;
  return { running: `Shipping ${what}`, succeeded: `Shipped ${what}`, failed: `Ship stopped`, stopped: `Waiting on review`, cancelled: `Ship cancelled` }[run.status];
}

function StepIcon({ status }: { status: RunStep["status"] }) {
  if (status === "running") return <Loader2 className="size-3.5 animate-spin text-staging" />;
  if (status === "done") return <Check className="size-3.5 text-prod" />;
  if (status === "failed") return <CircleX className="size-3.5 text-danger" />;
  if (status === "waiting-review") return <AlertTriangle className="size-3.5 text-staging" />;
  if (status === "skipped") return <Minus className="size-3.5 text-muted" />;
  return <span className="block size-3.5 rounded-full border border-line-strong" />;
}

const APP_TONE = { waiting: "neutral", building: "warn", healthy: "ok", failed: "danger", unhealthy: "danger" } as const;
const APP_WORD = { waiting: "waiting", building: "building", healthy: "healthy", failed: "failed", unhealthy: "not healthy" } as const;

export function RunSteps({ run }: { run: ApiShipRun }) {
  return (
    <ol className="space-y-1.5">
      {run.steps.map((s) => (
        <li key={s.id} className={clsx("rounded-xl px-3 py-2.5 text-[13px]", s.status === "failed" ? "bg-danger/8" : "bg-surface-2")}>
          <div className="flex items-center gap-2">
            <StepIcon status={s.status} />
            <span className={clsx(s.status === "pending" && "text-muted", s.status === "skipped" && "text-muted")}>
              {s.kind === "wait" ? (s.stage === "prod" ? "Production deploys and is healthy" : "Staging deploys and is healthy") : s.label}
            </span>
            {s.pr && (
              <a href={s.pr.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                #{s.pr.number} <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          {s.apps && s.apps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-5.5">
              {s.apps.map((a) => (
                <Badge key={a.uuid} tone={APP_TONE[a.state]}>
                  {a.state === "building" && <Loader2 className="size-3 animate-spin" />}
                  {a.name} {APP_WORD[a.state]}
                </Badge>
              ))}
            </div>
          )}
          {s.detail && s.kind === "merge" && <p className="mt-1 pl-5.5 text-[12px] text-muted">{s.detail}</p>}
          {s.detail && s.kind === "wait" && s.status !== "running" && !s.apps?.length && <p className="mt-1 pl-5.5 text-[12px] text-muted">{s.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ShipButton({ repo, status, disabled }: { repo: ApiRepo; status: RepoStatus | null | undefined; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const nothing = status ? status.pending.staging === 0 && status.pending.prod === 0 : false;
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} disabled={disabled || nothing} title={nothing ? "Production already has everything in dev" : undefined}>
        <Rocket className="size-3.5" /> Ship to production
      </Button>
      {open && <ShipDialog repo={repo} status={status} open onOpenChange={setOpen} />}
    </>
  );
}

/** A ship in progress on this repo, shown above the pipeline so it's never lost after closing the dialog. */
export function ActiveShip({ repo, status }: { repo: ApiRepo; status: RepoStatus | null | undefined }) {
  const runs = useRecentRuns(repo.fullName);
  const [open, setOpen] = useState(false);
  const run = runs.data?.runs?.[0];
  if (!run || run.status !== "running") return null;
  const step = run.steps.find((s) => s.status === "running") ?? run.steps.find((s) => s.status === "pending");
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pressable flex w-full items-center gap-3 rounded-xl bg-staging/12 px-4 py-3 text-left text-[13px]"
      >
        <Loader2 className="size-4 shrink-0 animate-spin text-staging" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Shipping to production.</span>{" "}
          <span className="text-ink-2">{step ? (step.kind === "wait" ? step.detail || step.label : step.label) : "Finishing up"}</span>
        </span>
        <span className="text-[12.5px] font-medium text-ink-2">Follow</span>
      </button>
      {open && <ShipDialog repo={repo} status={status} runId={run.id} open onOpenChange={setOpen} />}
    </>
  );
}

/** Open PRs into dev. Each can go all the way up in one go. */
export function OpenWorkList({ repo, status }: { repo: ApiRepo; status: RepoStatus | null | undefined }) {
  const [target, setTarget] = useState<OpenWork | null>(null);
  const work = status?.openWork ?? [];
  if (!work.length) return null;
  return (
    <Card className="overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] font-medium">
        Open PRs into {repo.branches!.dev} <span className="text-muted tabular-nums">{work.length}</span>
      </h2>
      <ul className="divide-y divide-line">
        {work.map((w) => (
          <li key={w.number} className="flex items-center gap-3 px-4 py-2.5">
            <GitPullRequest className="size-4 shrink-0 text-dev" aria-hidden />
            <div className="min-w-0 flex-1">
              <a href={w.url} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] hover:underline">
                {w.title} <span className="text-muted">#{w.number}</span>
              </a>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                {w.author && <Avatar src={githubAvatar(w.author)} alt={w.author} size={14} />}
                <span className="truncate font-mono">{w.head}</span>
                {w.draft && <Badge>Draft</Badge>}
              </p>
            </div>
            <Button size="sm" disabled={w.draft} onClick={() => setTarget(w)} title={w.draft ? "Mark it ready for review first" : `Merge #${w.number} and take it to production`}>
              Ship
            </Button>
          </li>
        ))}
      </ul>
      {target && <ShipDialog repo={repo} status={status} from={target.head} open onOpenChange={(o) => !o && setTarget(null)} />}
    </Card>
  );
}
