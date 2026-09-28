import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Power,
  Rocket,
  Server,
  ArrowUpRight,
  Ban,
  Clock,
  CornerDownRight,
  Flag,
  GitBranch,
  GitMerge,
  RefreshCw,
  SlidersHorizontal,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ApiEvent, EventType } from "../lib/api-types.ts";
import { ago, fullDate } from "../lib/time.ts";
import { Avatar, Empty, githubAvatar, Skeleton } from "./ui.tsx";

const LOOK: Record<EventType, { icon: LucideIcon; tone: string }> = {
  promoted: { icon: ArrowUpRight, tone: "text-prod" },
  "promotion-waiting": { icon: Clock, tone: "text-staging" },
  "promotion-conflict": { icon: GitMerge, tone: "text-danger" },
  synced: { icon: RefreshCw, tone: "text-ink-2" },
  "sync-conflict": { icon: GitMerge, tone: "text-danger" },
  "pr-blocked": { icon: Ban, tone: "text-danger" },
  "pr-retargeted": { icon: CornerDownRight, tone: "text-staging" },
  "branch-restored": { icon: Undo2, tone: "text-staging" },
  "direct-push": { icon: AlertTriangle, tone: "text-staging" },
  onboarded: { icon: Flag, tone: "text-ember" },
  "branch-created": { icon: GitBranch, tone: "text-ink-2" },
  "mode-changed": { icon: SlidersHorizontal, tone: "text-ink-2" },
  "deploy-succeeded": { icon: CircleCheck, tone: "text-prod" },
  "deploy-failed": { icon: CircleX, tone: "text-danger" },
  "deploy-triggered": { icon: Rocket, tone: "text-ink-2" },
  "app-stopped": { icon: Power, tone: "text-danger" },
  "coolify-setup": { icon: Server, tone: "text-ember" },
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function EventFeed({ events, loading, showRepo = false }: { events: ApiEvent[] | undefined; loading: boolean; showRepo?: boolean }) {
  if (loading && !events) {
    return (
      <div className="space-y-4 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    );
  }
  if (!events?.length) {
    return (
      <Empty title="Nothing yet">Promotions, blocked PRs and restored branches show up here as they happen.</Empty>
    );
  }

  const groups: { day: string; items: ApiEvent[] }[] = [];
  for (const e of events) {
    const day = dayLabel(e.createdAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div>
      {groups.map((g) => (
        <section key={g.day}>
          <h4 className="sticky top-0 z-[1] bg-surface/90 px-4 pt-3 pb-1.5 text-[11.5px] font-medium tracking-wide text-muted uppercase backdrop-blur">
            {g.day}
          </h4>
          <ol>
            {g.items.map((e, i) => (
              <EventRow key={e.id} event={e} showRepo={showRepo} index={i} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function EventRow({ event: e, showRepo, index }: { event: ApiEvent; showRepo: boolean; index: number }) {
  const look = LOOK[e.type] ?? LOOK["mode-changed"];
  const Icon = look.icon;
  const [owner, name] = e.repo.split("/");
  return (
    <li className="enter flex gap-3 px-4 py-2.5" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
      <span className={clsx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2", look.tone)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-ink">{e.summary}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
          {showRepo && owner && name && (
            <>
              <Link to="/$owner/$repo" params={{ owner, repo: name }} className="font-medium text-ink-2 hover:underline">
                {e.repo}
              </Link>
              <span aria-hidden>·</span>
            </>
          )}
          {e.actor && (
            <span className="inline-flex items-center gap-1">
              <Avatar src={githubAvatar(e.actor)} alt={e.actor} size={14} />
              {e.actor}
            </span>
          )}
          {e.actor && <span aria-hidden>·</span>}
          <time dateTime={e.createdAt} title={fullDate(e.createdAt)}>
            {ago(e.createdAt)}
          </time>
        </p>
      </div>
    </li>
  );
}
