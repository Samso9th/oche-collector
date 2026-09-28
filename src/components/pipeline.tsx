import { Menu } from "@base-ui/react/menu";
import NumberFlow from "@number-flow/react";
import clsx from "clsx";
import { ArrowDown, ArrowRight, Check, ExternalLink, MoreHorizontal, Zap } from "lucide-react";
import type { ApiRepo, BranchHead, OpenPromotion, Promotion, RepoStatus, Stage } from "../lib/api-types.ts";
import { ago } from "../lib/time.ts";
import { pendingFor, usePromoteAction } from "./promote.tsx";
import { Avatar, Button, githubAvatar, Skeleton, STAGE_LABEL, StageDot } from "./ui.tsx";

const RECENT_MS = 10 * 60_000;

/** The full dev → staging → production view on a repo page. */
export function Pipeline({ repo, status, loading }: { repo: ApiRepo; status: RepoStatus | null | undefined; loading: boolean }) {
  const promote = usePromoteAction(repo, status);
  const b = repo.branches!;
  const openFor = (base: string) => status?.openPromotions.find((p) => p.base === base && p.kind !== "sync-staging");

  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-0">
        <StageCard stage="dev" branch={b.dev} head={status?.heads.dev} loading={loading} />
        <Connector
          to="staging"
          pending={pendingFor(status, "staging")}
          open={openFor(b.staging)}
          busy={promote.pending === "staging"}
          onPromote={() => promote.request("staging")}
          loading={loading}
        />
        <StageCard stage="staging" branch={b.staging} head={status?.heads.staging} loading={loading} />
        <Connector
          to="prod"
          pending={pendingFor(status, "prod")}
          open={openFor(b.prod)}
          busy={promote.pending === "prod" || promote.pending === "prod-direct"}
          onPromote={() => promote.request("prod")}
          loading={loading}
        />
        <StageCard
          stage="prod"
          branch={b.prod}
          head={status?.heads.prod}
          loading={loading}
          menu={
            pendingFor(status, "prod-direct") > 0 && (
              <DirectMenu devBranch={b.dev} pending={pendingFor(status, "prod-direct")} onShip={() => promote.request("prod-direct")} />
            )
          }
        />
      </div>
      {promote.dialog}
    </>
  );
}

function StageCard({
  stage,
  branch,
  head,
  loading,
  menu,
}: {
  stage: Stage;
  branch: string;
  head: BranchHead | undefined;
  loading: boolean;
  menu?: React.ReactNode;
}) {
  const recent = head?.date ? Date.now() - new Date(head.date).getTime() < RECENT_MS : false;
  return (
    <section className="flex min-w-0 flex-col rounded-xl bg-surface p-4 shadow-card" aria-label={STAGE_LABEL[stage]}>
      <header className="flex items-center gap-2">
        <StageDot stage={stage} live={recent} />
        <h3 className="text-[13px] font-medium">{STAGE_LABEL[stage]}</h3>
        <span className="ml-auto truncate font-mono text-[12px] text-muted">{branch}</span>
        {menu}
      </header>
      <div className="mt-3 min-h-[52px] flex-1">
        {loading && !head ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : head ? (
          <>
            <p className="line-clamp-2 text-[13.5px] leading-snug text-ink" title={head.message}>
              {head.message}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
              <Avatar src={head.avatarUrl ?? githubAvatar(head.author)} alt={head.author ?? "?"} size={16} />
              <span className="truncate">{head.author}</span>
              <span aria-hidden>·</span>
              <time dateTime={head.date ?? undefined} className="shrink-0">
                {ago(head.date)}
              </time>
              <span className="ml-auto font-mono text-[11.5px]">{head.sha.slice(0, 7)}</span>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">Branch not found. Setting the repo up again recreates it.</p>
        )}
      </div>
    </section>
  );
}

function Connector({
  to,
  pending,
  open,
  busy,
  onPromote,
  loading,
}: {
  to: "staging" | "prod";
  pending: number;
  open: OpenPromotion | undefined;
  busy: boolean;
  onPromote: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-2 py-1 lg:flex-col lg:gap-2 lg:px-3 lg:py-0">
      <div className="flex items-center gap-1.5 text-[12px] text-muted lg:flex-col lg:gap-1">
        {loading && pending === 0 ? (
          <Skeleton className="h-3 w-14" />
        ) : pending > 0 ? (
          <span className="tabular-nums">
            <NumberFlow value={pending} /> commit{pending === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Check className="size-3" /> In step
          </span>
        )}
        <ArrowRight className="hidden size-4 text-line-strong lg:block" aria-hidden />
        <ArrowDown className="size-4 text-line-strong lg:hidden" aria-hidden />
      </div>
      {open ? (
        <a
          href={open.url}
          target="_blank"
          rel="noreferrer"
          className="pressable inline-flex h-7 items-center gap-1 rounded-md bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 shadow-card hover:bg-surface-2"
        >
          #{open.number} open <ExternalLink className="size-3" />
        </a>
      ) : (
        <Button size="sm" disabled={pending === 0} loading={busy} onClick={onPromote}>
          Promote
        </Button>
      )}
    </div>
  );
}

function DirectMenu({ devBranch, pending, onShip }: { devBranch: string; pending: number; onShip: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="pressable -mr-1 grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        aria-label="More production actions"
      >
        <MoreHorizontal className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="popup min-w-60 rounded-xl bg-surface p-1 shadow-pop outline-none">
            <Menu.Item
              onClick={onShip}
              className="flex cursor-default items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none select-none data-highlighted:bg-surface-2"
            >
              <Zap className="mt-0.5 size-3.5 text-ember" />
              <span>
                <span className="block font-medium">Ship {devBranch} straight to production</span>
                <span className="block text-[12px] text-muted">
                  {pending} commit{pending === 1 ? "" : "s"}, skipping staging
                </span>
              </span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A compact one-line version for the projects list. */
export function PipelineStrip({ repo, status, loading }: { repo: ApiRepo; status: RepoStatus | null | undefined; loading: boolean }) {
  const promote = usePromoteAction(repo, status);
  const steps: { stage: Stage; promotion?: Promotion }[] = [{ stage: "dev" }, { stage: "staging", promotion: "staging" }, { stage: "prod", promotion: "prod" }];
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {steps.map(({ stage, promotion }) => {
        const pending = promotion ? pendingFor(status, promotion) : 0;
        return (
          <div key={stage} className="flex items-center gap-1">
            {promotion && (
              <button
                type="button"
                disabled={loading || pending === 0 || promote.pending === promotion}
                onClick={() => promote.request(promotion)}
                title={pending > 0 ? `Promote ${pending} commit${pending === 1 ? "" : "s"} to ${STAGE_LABEL[stage].toLowerCase()}` : "Nothing to promote"}
                className={clsx(
                  "pressable inline-flex h-6 min-w-9 items-center justify-center gap-0.5 rounded-full px-1.5 text-[11.5px] font-medium tabular-nums",
                  pending > 0 ? "bg-surface text-ink shadow-card hover:bg-surface-2" : "text-line-strong",
                  promote.pending === promotion && "opacity-60",
                )}
              >
                {pending > 0 ? (
                  <>
                    <NumberFlow value={pending} />
                    <ArrowRight className="size-3" />
                  </>
                ) : (
                  <span className="h-px w-5 bg-line-strong" />
                )}
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[12px] text-ink-2">
              <StageDot stage={stage} />
              <span>{STAGE_LABEL[stage]}</span>
            </span>
          </div>
        );
      })}
      {promote.dialog}
    </div>
  );
}
