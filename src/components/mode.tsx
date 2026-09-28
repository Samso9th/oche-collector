import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ApiRepo, Mode } from "../lib/api-types.ts";
import { useUpdateRepo } from "../lib/queries.ts";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "fast", label: "Fast", hint: "No reviews. Promotions merge the moment you click." },
  { value: "strict", label: "Strict", hint: "Every PR into a managed branch needs approval before it merges." },
];

/** Fast / Strict with a sliding thumb. Changed rarely, so it's allowed a little motion. */
export function ModeSwitch({ repo, canEdit }: { repo: ApiRepo; canEdit: boolean }) {
  const update = useUpdateRepo(repo.fullName);
  const index = MODES.findIndex((m) => m.value === repo.mode);

  const set = (patch: { mode?: Mode; requiredApprovals?: number }) =>
    update.mutate(patch, {
      onError: (e) => toast.error("Couldn't change the mode", { description: e.message }),
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Review mode" className="relative grid grid-cols-2 rounded-lg bg-surface-2 p-0.5">
          <span
            aria-hidden
            className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-surface shadow-card transition-transform duration-200 ease-(--ease-in-out)"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={repo.mode === m.value}
              disabled={!canEdit || update.isPending}
              onClick={() => repo.mode !== m.value && set({ mode: m.value })}
              className={clsx(
                "relative z-[1] h-7 min-w-16 px-3 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed",
                repo.mode === m.value ? "text-ink" : "text-muted hover:text-ink-2",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {repo.mode === "strict" && (
          <div className="inline-flex items-center gap-1 text-[13px] text-ink-2">
            <Stepper
              value={repo.requiredApprovals}
              min={1}
              max={6}
              disabled={!canEdit || update.isPending}
              onChange={(n) => set({ requiredApprovals: n })}
            />
            approval{repo.requiredApprovals === 1 ? "" : "s"}
          </div>
        )}
      </div>
      <p className="text-[12.5px] text-muted">{MODES[index]?.hint}</p>
    </div>
  );
}

function Stepper({ value, min, max, disabled, onChange }: { value: number; min: number; max: number; disabled: boolean; onChange: (n: number) => void }) {
  const btn = "pressable grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40";
  return (
    <span className="inline-flex items-center rounded-lg bg-surface p-0.5 shadow-card">
      <button className={btn} aria-label="Fewer approvals" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-3" />
      </button>
      <span className="w-5 text-center font-medium tabular-nums">{value}</span>
      <button className={btn} aria-label="More approvals" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-3" />
      </button>
    </span>
  );
}
