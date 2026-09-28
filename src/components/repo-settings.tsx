import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, Stage } from "../lib/api-types.ts";
import { useUpdateRepo } from "../lib/queries.ts";
import { Button, Card, Select, STAGE_LABEL, StageDot } from "./ui.tsx";

const field = "field h-8 w-full min-w-0 rounded-lg bg-surface px-2.5 text-[13px] outline-none";

/** Branch mapping, how work PRs land in dev, and the staging gate. */
export function RepoSettings({ repo, canEdit }: { repo: ApiRepo; canEdit: boolean }) {
  const update = useUpdateRepo(repo.fullName);
  const [branches, setBranches] = useState(repo.branches!);
  useEffect(() => setBranches(repo.branches!), [repo.branches]);
  const dirty = (["dev", "staging", "prod"] as Stage[]).some((s) => branches[s].trim() !== repo.branches![s]);

  const save = (patch: Parameters<typeof update.mutate>[0], ok: string) =>
    update.mutate(patch, {
      onSuccess: () => toast.success(ok),
      onError: (e) => {
        toast.error("Couldn't save", { description: e.message });
        setBranches(repo.branches!);
      },
    });

  return (
    <Card className="self-start p-4">
      <h2 className="text-[13px] font-medium">Settings</h2>

      <div className="mt-3 space-y-1.5">
        <p className="text-[12px] font-medium text-ink-2">Branches</p>
        {(["dev", "staging", "prod"] as Stage[]).map((s) => (
          <label key={s} className="flex items-center gap-2">
            <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-[12px] text-muted">
              <StageDot stage={s} /> {STAGE_LABEL[s]}
            </span>
            <input
              value={branches[s]}
              onChange={(e) => setBranches({ ...branches, [s]: e.target.value })}
              disabled={!canEdit}
              className={`${field} font-mono`}
              spellCheck={false}
              aria-label={`${STAGE_LABEL[s]} branch`}
            />
          </label>
        ))}
        {dirty && (
          <div className="flex justify-end gap-1.5 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setBranches(repo.branches!)}>
              Reset
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                save(
                  { branches: { dev: branches.dev.trim(), staging: branches.staging.trim(), prod: branches.prod.trim() } },
                  "Branches updated",
                )
              }
            >
              Save branches
            </Button>
          </div>
        )}
        <p className="text-[11.5px] text-muted">The branch must exist on GitHub. Changing dev also makes it the default branch.</p>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-[12px] font-medium text-ink-2">Work PRs into {repo.branches!.dev}</span>
        <Select
          value={repo.workMergeMethod}
          disabled={!canEdit}
          onChange={(workMergeMethod) => save({ workMergeMethod }, "Saved")}
          aria-label="Merge method"
          options={[
            { value: "merge", label: "Merge commit", hint: "Keeps every commit" },
            { value: "squash", label: "Squash", hint: "One commit per PR" },
            { value: "rebase", label: "Rebase", hint: `Commits replayed on ${repo.branches!.dev}` },
          ]}
        />
        <span className="mt-1 block text-[11.5px] text-muted">
          {repo.workMergeMethod === "squash"
            ? "Tidy history, but keep branches short-lived: reusing a branch after a squash brings its old commits back."
            : "Promotions between dev, staging and production always use merge commits."}
        </span>
      </label>

      <label className="mt-4 flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 accent-[var(--ember)]"
          checked={repo.gateOnStaging}
          disabled={!canEdit || !repo.coolifyLinked}
          onChange={(e) => save({ gateOnStaging: e.target.checked }, e.target.checked ? "Production waits for staging" : "Production no longer waits")}
        />
        <span className="text-[12.5px]">
          <span className="font-medium">Hold production until staging is healthy</span>
          <span className="block text-[11.5px] text-muted">
            {repo.coolifyLinked
              ? "When shipping, Oche waits for staging to deploy and pass its health check before merging into production."
              : "Link a Coolify under Deployments to use this."}
          </span>
        </span>
      </label>
    </Card>
  );
}
