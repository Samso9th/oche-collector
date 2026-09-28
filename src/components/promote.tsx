import { useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, PromoteResponse, Promotion, RepoStatus } from "../lib/api-types.ts";
import { AlertTriangle, Loader2 } from "lucide-react";
import { usePreflight, usePromote } from "../lib/queries.ts";
import { BranchName, Button, Dialog } from "./ui.tsx";

/** Conflicts and blocks come back as 200s; treat them as failures so the toast reads as one. */
class PromoteProblem extends Error {
  result: Extract<PromoteResponse, { status: "conflict" | "blocked" }>;
  constructor(result: Extract<PromoteResponse, { status: "conflict" | "blocked" }>) {
    super(result.status);
    this.result = result;
  }
}

const TARGET: Record<Promotion, "staging" | "prod"> = { staging: "staging", prod: "prod", "prod-direct": "prod" };

export function promotionRefs(repo: ApiRepo, to: Promotion) {
  const b = repo.branches!;
  if (to === "staging") return { from: b.dev, to: b.staging };
  if (to === "prod") return { from: b.staging, to: b.prod };
  return { from: b.dev, to: b.prod };
}

export function pendingFor(status: RepoStatus | null | undefined, to: Promotion) {
  if (!status) return 0;
  return to === "staging" ? status.pending.staging : to === "prod" ? status.pending.prod : status.pending.prodDirect;
}

/**
 * One place that knows how to promote and how to talk about the result.
 * Staging goes on one click. Production asks first: it's the one that's hard to take back.
 */
export function usePromoteAction(repo: ApiRepo, status: RepoStatus | null | undefined) {
  const mutation = usePromote(repo.fullName);
  const [confirming, setConfirming] = useState<Promotion | null>(null);

  const run = (to: Promotion) => {
    const { from, to: target } = promotionRefs(repo, to);
    const done = mutation.mutateAsync(to).then((r) => {
      if (r.status === "conflict" || r.status === "blocked") throw new PromoteProblem(r);
      return r;
    });
    toast.promise(done, {
      loading: `Promoting ${from} → ${target}…`,
      success: (r) => {
        switch (r.status) {
          case "merged":
            return {
              message: `Merged ${from} into ${target}`,
              description: `#${r.pr.number}. Coolify picks it up from here.`,
              action: { label: "View PR", onClick: () => window.open(r.pr.url, "_blank") },
            };
          case "waiting-review":
            return {
              message: `Waiting on review`,
              description: r.approval.changesRequested
                ? `#${r.pr.number} has changes requested.`
                : `#${r.pr.number} has ${r.approval.approvals} of ${r.approval.required} approvals.`,
              action: { label: "Open PR", onClick: () => window.open(r.pr.url, "_blank") },
            };
          case "nothing-to-promote":
            return { message: `${target} already has everything in ${from}` };
        }
      },
      error: (e: Error) => {
        if (!(e instanceof PromoteProblem)) return { message: "Promotion failed", description: e.message };
        const r = e.result;
        if (r.status === "blocked") return { message: "Not allowed", description: r.reason };
        return {
          message: `${from} → ${target} has conflicts`,
          description: `Resolve #${r.pr.number} on GitHub, then promote again.`,
          action: { label: "Resolve", onClick: () => window.open(r.pr.url, "_blank") },
        };
      },
    });
  };

  const request = (to: Promotion) => (TARGET[to] === "prod" ? setConfirming(to) : run(to));

  const dialog = confirming && repo.branches && (
    <ConfirmProd
      repo={repo}
      to={confirming}
      pending={pendingFor(status, confirming)}
      strict={repo.mode === "strict"}
      onCancel={() => setConfirming(null)}
      onConfirm={() => {
        run(confirming);
        setConfirming(null);
      }}
    />
  );

  return { request, pending: mutation.isPending ? mutation.variables : null, dialog };
}

function ConfirmProd({
  repo,
  to,
  pending,
  strict,
  onCancel,
  onConfirm,
}: {
  repo: ApiRepo;
  to: Promotion;
  pending: number;
  strict: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { from, to: target } = promotionRefs(repo, to);
  const direct = to === "prod-direct";
  const preflight = usePreflight(repo.fullName, "prod", repo.coolifyLinked);
  const pf = preflight.data;
  const warnings = pf
    ? [
        ...pf.envIssues.flatMap((i) => [
          ...(i.missing.length ? [`${i.app} in production is missing ${i.missing.slice(0, 4).join(", ")}${i.missing.length > 4 ? "…" : ""}.`] : []),
          ...(i.shared.length ? [`${i.app} shares ${i.shared.slice(0, 3).join(", ")} with staging.`] : []),
        ]),
        ...(!direct && pf.below?.unhealthy.length ? [`Staging isn't healthy: ${pf.below.unhealthy.map((u) => u.name).join(", ")}.`] : []),
      ]
    : [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={direct ? "Ship dev straight to production?" : "Promote to production?"}
      description={
        strict
          ? `Oche opens the PR and merges it once it has ${repo.requiredApprovals} approval${repo.requiredApprovals === 1 ? "" : "s"}.`
          : "Oche opens the PR and merges it right away. Coolify deploys when it lands."
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <BranchName name={from} stage={direct ? "dev" : "staging"} />
        <span className="text-xs text-muted">
          {pending} commit{pending === 1 ? "" : "s"} →
        </span>
        <BranchName name={target} stage="prod" />
      </div>
      {preflight.isLoading && repo.coolifyLinked && (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
          <Loader2 className="size-3 animate-spin" /> Checking environment variables and staging…
        </p>
      )}
      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg bg-staging/12 px-3 py-2.5 text-[12.5px] text-ink-2">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5 text-staging" /> Before you promote
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {direct && (
        <p className="mt-3 text-[13px] text-muted">
          This skips {repo.branches!.staging}. Afterwards Oche merges {repo.branches!.prod} back into {repo.branches!.staging} so they stay in step.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} autoFocus>
          {warnings.length ? "Promote anyway" : direct ? "Ship to production" : "Promote to production"}
        </Button>
      </div>
    </Dialog>
  );
}
