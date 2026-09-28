import { ArrowRight, GitPullRequest, Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, OpenWork, RepoStatus, ShipResponse } from "../lib/api-types.ts";
import { useShip } from "../lib/queries.ts";
import { Avatar, Badge, BranchName, Button, Card, Dialog, githubAvatar } from "./ui.tsx";

type Hop = { head: string; base: string; stage: "dev" | "staging" | "prod"; pending: number | null; note?: string };

function hops(repo: ApiRepo, status: RepoStatus | null | undefined, from?: string): Hop[] {
  const b = repo.branches!;
  const list: Hop[] = [];
  if (from && from !== b.dev) list.push({ head: from, base: b.dev, stage: "dev", pending: null, note: "squash-merge the PR" });
  list.push({ head: b.dev, base: b.staging, stage: "staging", pending: from && from !== b.dev ? null : (status?.pending.staging ?? null) });
  list.push({ head: b.staging, base: b.prod, stage: "prod", pending: from && from !== b.dev ? null : (status?.pending.prod ?? null) });
  return list;
}

function summarize(r: ShipResponse) {
  const last = r.steps.at(-1);
  if (r.completed) {
    const merged = r.steps.filter((s) => s.status === "merged").length;
    return { ok: true, title: merged ? "Shipped to production" : "Production already has everything", body: merged ? "Coolify deploys each branch as it lands." : undefined };
  }
  if (!last) return { ok: false, title: "Nothing ran" };
  if (last.status === "waiting-review") return { ok: false, title: `Stopped at ${last.label}`, body: `Waiting on review: ${last.approval.approvals} of ${last.approval.required} approvals.`, url: last.pr.url };
  if (last.status === "conflict") return { ok: false, title: `Stopped at ${last.label}`, body: "It has merge conflicts. Resolve them on GitHub, then ship again.", url: last.pr.url };
  if (last.status === "blocked") return { ok: false, title: `Stopped at ${last.label}`, body: last.reason };
  return { ok: false, title: `Stopped at ${last.label}` };
}

/** One confirmation, then every hop to production. Stops at the first one that can't finish. */
export function ShipDialog({ repo, status, from, open, onOpenChange }: { repo: ApiRepo; status: RepoStatus | null | undefined; from?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ship = useShip(repo.fullName);
  const steps = hops(repo, status, from);
  const strict = repo.mode === "strict";

  const run = () => {
    onOpenChange(false);
    const done = ship.mutateAsync({ from, to: "prod" }).then((r) => {
      const s = summarize(r);
      if (!s.ok) throw Object.assign(new Error(s.title), { detail: s });
      return s;
    });
    toast.promise(done, {
      loading: `Shipping ${from ?? repo.branches!.dev} to production…`,
      success: (s) => ({ message: s.title, description: s.body }),
      error: (e: Error & { detail?: ReturnType<typeof summarize> }) => {
        const d = e.detail;
        if (!d) return { message: "Ship failed", description: e.message };
        return { message: d.title, description: d.body, action: d.url ? { label: "Open PR", onClick: () => window.open(d.url, "_blank") } : undefined };
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Ship ${from ?? repo.branches!.dev} to production?`}
      description={strict ? `Strict mode: Oche stops at the first step that doesn't have ${repo.requiredApprovals} approval${repo.requiredApprovals === 1 ? "" : "s"} yet.` : "Oche runs these in order and stops if one can't merge."}
    >
      <ol className="space-y-2">
        {steps.map((h, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-medium text-muted shadow-card">{i + 1}</span>
            <BranchName name={h.head} stage={h.stage === "dev" ? undefined : h.stage === "staging" ? "dev" : "staging"} />
            <ArrowRight className="size-3.5 text-muted" aria-hidden />
            <BranchName name={h.base} stage={h.stage} />
            <span className="ml-auto text-[12px] text-muted">
              {h.note ?? (h.pending === null ? "" : h.pending === 0 ? "up to date" : `${h.pending} commit${h.pending === 1 ? "" : "s"}`)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12.5px] text-muted">Coolify deploys {repo.branches!.staging} and {repo.branches!.prod} as each merge lands.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={run} autoFocus>
          <Rocket className="size-3.5" /> Ship to production
        </Button>
      </div>
    </Dialog>
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

