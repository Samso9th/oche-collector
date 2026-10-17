import { Menu } from "@base-ui/react/menu";
import clsx from "clsx";
import { CircleCheck, CircleX, ExternalLink, MoreHorizontal, Package, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, NpmStatusResponse } from "../lib/api-types.ts";
import { useMe, useNpm, useRemoveNpm, useSetupNpm, useUpdateNpm } from "../lib/queries.ts";
import { ago, fullDate } from "../lib/time.ts";
import { CopyButton } from "./coolify.tsx";
import { Badge, Button, Card, Dialog, Skeleton } from "./ui.tsx";

/** npm publishing: shown for repos whose root package.json can be published, or that already publish. */
export function NpmSection({ repo }: { repo: ApiRepo }) {
  const q = useNpm(repo.fullName);
  const me = useMe();
  const isOwner = me.data?.role === "owner";
  const [setupOpen, setSetupOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (q.isLoading) return <Skeleton className="h-28 rounded-xl" />;
  if (q.isError || !q.data) return null;
  const st = q.data;
  if (!st.publishing && st.blocked) return null;

  const name = st.publishing?.packageName ?? st.detected.name!;
  const run = st.publishing?.lastRun;

  return (
    <section aria-labelledby="npm" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="npm" className="flex items-center gap-2 text-[13px] font-medium text-muted">
          npm
          {st.registry?.exists && (
            <a href={st.registry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-normal hover:text-ink">
              {name} <ExternalLink className="size-3" />
            </a>
          )}
        </h2>
        {isOwner && st.publishing && (
          <Menu.Root>
            <Menu.Trigger className="pressable grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label="npm options">
              <MoreHorizontal className="size-4" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="z-50">
                <Menu.Popup className="popup min-w-48 rounded-xl bg-surface p-1 shadow-pop outline-none">
                  <Menu.Item
                    onClick={() => setRemoveOpen(true)}
                    className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-danger outline-none select-none data-highlighted:bg-surface-2"
                  >
                    Stop publishing
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>

      {!st.permissions.ok && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-staging/12 px-4 py-3 text-[13px]">
          <ShieldAlert className="size-4 shrink-0 text-staging" />
          <p className="min-w-0 flex-1">
            <span className="font-medium">Oche's GitHub App needs new permissions to add workflows.</span>{" "}
            <span className="text-ink-2">Missing {st.permissions.missing.join(", ")}.</span>
          </p>
          {st.permissions.fixUrl && (
            <a href={st.permissions.fixUrl} target="_blank" rel="noreferrer" className="font-medium text-staging hover:underline">
              Review on GitHub
            </a>
          )}
        </div>
      )}

      {run?.conclusion === "failure" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/8 px-4 py-3 text-[13px]">
          <CircleX className="size-4 shrink-0 text-danger" />
          <p className="min-w-0 flex-1">
            <span className="font-medium">
              Publishing {name} failed{run.failedStep ? ` at “${run.failedStep}”` : ""} {ago(run.at)}.
            </span>{" "}
            <span className="text-ink-2">{failureHint(run.failedStep, st)}</span>
          </p>
          <a href={run.url} target="_blank" rel="noreferrer" className="font-medium text-danger hover:underline">
            View run
          </a>
        </div>
      )}

      {st.publishing ? (
        <Publishing repo={repo} st={st} canEdit={isOwner} onUpdate={() => setSetupOpen(true)} />
      ) : (
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ember">
            <Package className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">Publish {name} on every release</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Each push to {repo.branches!.prod} publishes a new version, picked from your commit messages. No npm token is stored anywhere.
              {st.registry && !st.registry.exists && " It isn't on npm yet, so the first version goes up from your machine."}
            </p>
          </div>
          {isOwner ? (
            <Button variant="primary" onClick={() => setSetupOpen(true)}>
              Set up publishing
            </Button>
          ) : (
            <span className="text-[12.5px] text-muted">The Oche owner can set this up.</span>
          )}
        </Card>
      )}

      <SetupDialog repo={repo} st={st} open={setupOpen} onOpenChange={setSetupOpen} />
      <RemoveDialog repo={repo} name={name} open={removeOpen} onOpenChange={setRemoveOpen} />
    </section>
  );
}

function failureHint(step: string | null, st: NpmStatusResponse) {
  if (step === "Publish") {
    return st.publishing?.trustedAt
      ? "npm refused it. Check the Trusted Publisher on npmjs.com still names this repo and oche-publish.yml."
      : "npm doesn't trust the workflow yet. Run the command below, then re-run the job.";
  }
  if (step === "Tag") return "The package went up, but the tag push failed. Let GitHub Actions push tags in this repo.";
  if (step === "Decide the version") return "Oche couldn't work out the version. The run log says why.";
  return "Nothing was published. The run log has the details.";
}

function Publishing({ repo, st, canEdit, onUpdate }: { repo: ApiRepo; st: NpmStatusResponse; canEdit: boolean; onUpdate: () => void }) {
  const update = useUpdateNpm(repo.fullName);
  const p = st.publishing!;
  const trustStep = st.steps.find((s) => s.id === "trust");

  return (
    <Card className="grid gap-5 p-4 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[15px] font-semibold">{st.registry?.latest ?? p.lastVersion ?? "not published"}</span>
          {st.registry?.publishedAt && (
            <span className="text-[12.5px] text-muted" title={fullDate(st.registry.publishedAt)}>
              on npm {ago(st.registry.publishedAt)}
            </span>
          )}
          {p.outdated && <Badge tone="warn">workflow out of date</Badge>}
        </div>

        <ol className="mt-3 space-y-1.5">
          {st.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-[12.5px]">
              {s.done ? <CircleCheck className="mt-px size-3.5 shrink-0 text-prod" /> : <span className="mt-[3px] size-2.5 shrink-0 rounded-full border border-line-strong" />}
              <span className={clsx(s.done ? "text-ink-2" : "text-ink")}>
                {s.label}
                {!s.done && s.hint && <span className="block text-[11.5px] text-muted">{s.hint}</span>}
              </span>
            </li>
          ))}
        </ol>

        {!trustStep?.done && st.trustCommand && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{st.trustCommand}</code>
            <CopyButton text={st.trustCommand} label="Copy" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-3 sm:w-56">
        {p.setupPr && !st.steps.find((s) => s.id === "workflow")?.done && (
          <a href={p.setupPr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ember hover:underline">
            Workflow PR #{p.setupPr.number} <ExternalLink className="size-3" />
          </a>
        )}
        {p.outdated && canEdit && (
          <Button size="sm" onClick={onUpdate}>
            Update workflow
          </Button>
        )}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-3.5 accent-[var(--ember)]"
            checked={p.runTests}
            disabled={!canEdit || !st.detected.hasTests}
            onChange={(e) =>
              update.mutate(
                { runTests: e.target.checked },
                {
                  onSuccess: () => toast.success(e.target.checked ? "Tests run before publishing" : "Tests skipped", { description: "Update the workflow to apply it." }),
                  onError: (err) => toast.error("Couldn't save", { description: err.message }),
                },
              )
            }
          />
          <span className="text-[12.5px]">
            <span className="font-medium">Run tests before publishing</span>
            <span className="block text-[11.5px] text-muted">{st.detected.hasTests ? "npm test must pass first." : "package.json has no test script."}</span>
          </span>
        </label>
      </div>
    </Card>
  );
}

function SetupDialog({ repo, st, open, onOpenChange }: { repo: ApiRepo; st: NpmStatusResponse; open: boolean; onOpenChange: (o: boolean) => void }) {
  const preview = useSetupNpm(repo.fullName);
  const setup = useSetupNpm(repo.fullName);
  const [force, setForce] = useState(false);
  const others = st.publishing ? [] : st.detected.otherPublishers;
  const updating = Boolean(st.publishing);

  const { mutate: loadPreview, reset: resetPreview } = preview;
  useEffect(() => {
    if (open) loadPreview({ dryRun: true, force: true });
    else {
      resetPreview();
      setForce(false);
    }
  }, [open, loadPreview, resetPreview]);
  const load = onOpenChange;

  const submit = () =>
    setup.mutate(
      { force: force || undefined },
      {
        onSuccess: (res) => {
          onOpenChange(false);
          if (!res.pr) toast.success("The workflow is already on dev");
          else toast.success(res.pr.merged ? `Merged #${res.pr.number} into ${repo.branches!.dev}` : `Opened #${res.pr.number}`, {
            description: res.pr.merged ? "Ship to production to start publishing." : "Merge it, then ship to production.",
            action: { label: "Open", onClick: () => window.open(res.pr!.url, "_blank") },
          });
        },
        onError: (e) => toast.error("Couldn't set up publishing", { description: e.message }),
      },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={load}
      size="lg"
      title={updating ? "Update the publish workflow" : `Publish ${st.detected.name} to npm`}
      description={`Oche opens a PR into ${repo.branches!.dev} adding ${preview.data?.path ?? ".github/workflows/oche-publish.yml"}. ${
        repo.mode === "fast" ? "In fast mode it's merged straight away." : "It waits for reviews like any PR."
      } Publishing starts once it reaches ${repo.branches!.prod}.`}
    >
      <ul className="space-y-1 text-[12.5px] text-ink-2">
        <li>• The version comes from commits: feat → minor, fix and the rest → patch, a breaking change → major.</li>
        <li>• Each release is tagged v1.2.3. Nothing is committed back to your branches.</li>
        <li>• npm signs in through Trusted Publishing, so no token is stored. Run `oche npm setup` once so npm trusts the workflow.</li>
      </ul>

      {others.length > 0 && (
        <label className="mt-4 flex items-start gap-2 rounded-lg bg-staging/12 px-3 py-2.5 text-[12.5px]">
          <input type="checkbox" className="mt-0.5 size-3.5 accent-[var(--ember)]" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span>
            <span className="font-medium">{others.join(", ")} already publishes to npm.</span>
            <span className="block text-ink-2">Remove it first, or tick this to add Oche's anyway. Two publishers will race each other.</span>
          </span>
        </label>
      )}

      <div className="mt-4 overflow-hidden rounded-lg bg-surface-2">
        {preview.isPending || preview.isIdle ? (
          <Skeleton className="h-48" />
        ) : preview.isError ? (
          <p className="px-3 py-2.5 text-[12.5px] text-danger">{preview.error.message}</p>
        ) : (
          <pre className="max-h-72 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">{previewText(preview.data!.workflow)}</pre>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => load(false)}>
          Cancel
        </Button>
        <Button variant="primary" loading={setup.isPending} disabled={!st.permissions.ok || (others.length > 0 && !force)} onClick={submit}>
          {updating ? "Open update PR" : "Open PR"}
        </Button>
      </div>
      {!st.permissions.ok && <p className="mt-2 text-right text-[12px] text-muted">Accept the new GitHub App permissions first.</p>}
    </Dialog>
  );
}

/** The workflow without the embedded release script, which is long and the same everywhere. */
function previewText(workflow: string) {
  return workflow.replace(/(<<'OCHE_RELEASE_SCRIPT'\n)[\s\S]*?(\n\s*OCHE_RELEASE_SCRIPT\n)/, "$1          # … Oche's release script (picks the version) …$2");
}

function RemoveDialog({ repo, name, open, onOpenChange }: { repo: ApiRepo; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const remove = useRemoveNpm(repo.fullName);
  const [removeWorkflow, setRemoveWorkflow] = useState(true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Stop publishing ${name}?`} description="Oche stops tracking releases for this repo.">
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" className="mt-0.5 size-3.5 accent-[var(--ember)]" checked={removeWorkflow} onChange={(e) => setRemoveWorkflow(e.target.checked)} />
        <span>
          <span className="font-medium">Open a PR that removes the workflow</span>
          <span className="block text-[12px] text-muted">Without it, pushes to {repo.branches!.prod} keep publishing. Revoke the trust on npmjs.com too.</span>
        </span>
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(removeWorkflow, {
              onSuccess: (res) => {
                onOpenChange(false);
                toast.success(`Stopped publishing ${name}`, res.pr ? { action: { label: `Open #${res.pr.number}`, onClick: () => window.open(res.pr!.url, "_blank") } } : undefined);
              },
              onError: (e) => toast.error("Couldn't stop publishing", { description: e.message }),
            })
          }
        >
          Stop publishing
        </Button>
      </div>
    </Dialog>
  );
}
