import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";
import type { ApiRepo } from "../lib/api-types.ts";
import { useOnboard, useOnboardPlan } from "../lib/queries.ts";
import { Button, Dialog, Skeleton } from "./ui.tsx";

/** Shows exactly what Oche will change before it changes anything. */
export function OnboardDialog({ repo, open, onOpenChange }: { repo: ApiRepo; open: boolean; onOpenChange: (o: boolean) => void }) {
  const plan = useOnboardPlan(repo.fullName, open);
  const apply = useOnboard(repo.fullName);
  const navigate = useNavigate();
  const steps = plan.data?.plan.steps;
  const allDone = steps?.every((s) => s.done);

  const run = () =>
    apply.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${repo.name} is set up`, { description: "Oche guards its PRs from now on." });
        onOpenChange(false);
        void navigate({ to: "/$owner/$repo", params: { owner: repo.owner, repo: repo.name } });
      },
      onError: (e) => toast.error("Setup didn't finish", { description: e.message }),
    });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Set up ${repo.name}`}
      description="Here's what Oche will do on GitHub. You can change the mode afterwards."
    >
      {plan.isError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{plan.error.message}</p>
      ) : (
        <ol className="space-y-2.5">
          {(steps ?? [0, 1, 2, 3]).map((s, i) =>
            typeof s === "number" ? (
              <li key={i} className="flex items-center gap-2.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3.5 flex-1" />
              </li>
            ) : (
              <li key={s.id} className="flex items-start gap-2.5 text-[13.5px]">
                {s.done ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-prod" aria-label="Already done" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" aria-label="To do" />
                )}
                <span className={clsx(s.done && "text-muted")}>{s.label}</span>
              </li>
            ),
          )}
        </ol>
      )}
      <p className="mt-4 text-[12.5px] text-muted">
        After this, PRs into {plan.data?.plan.branches.staging ?? "staging"} or {plan.data?.plan.branches.prod ?? "main"} from any other branch get
        moved to {plan.data?.plan.branches.dev ?? "dev"} or closed.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={run} disabled={!plan.data || plan.isError} loading={apply.isPending}>
          {allDone ? "Start guarding" : "Set up"}
        </Button>
      </div>
    </Dialog>
  );
}
