import { Menu } from "@base-ui/react/menu";
import clsx from "clsx";
import { Check, CircleCheck, CircleX, Copy, ExternalLink, History, Loader2, MoreHorizontal, Plus, RotateCw, Sparkles, SquareTerminal, Unlink } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { ApiCoolifyApp, ApiDeployment, ApiRepo, Stage } from "../lib/api-types.ts";
import {
  isActive,
  useAddCoolify,
  useCoolifyInstances,
  useDeploymentDetail,
  useDeployments,
  useExplain,
  useLinkCoolify,
  useMe,
  useRedeploy,
  useRollback,
  useRollbackOptions,
  useUnlinkCoolify,
} from "../lib/queries.ts";
import { ago } from "../lib/time.ts";
import { CoolifySetupDialog } from "./coolify-setup.tsx";
import { Badge, Button, Card, Dialog, Empty, Skeleton, STAGE_LABEL, StageDot } from "./ui.tsx";

/* ---------------- small pieces ---------------- */

export function DeployIcon({ status, className }: { status: string | undefined; className?: string }) {
  if (!status) return <span className={clsx("inline-block size-3.5 rounded-full border border-line-strong", className)} aria-label="Never deployed" />;
  if (isActive(status)) return <Loader2 className={clsx("size-3.5 animate-spin text-staging", className)} aria-label="Deploying" />;
  if (status === "finished") return <CircleCheck className={clsx("size-3.5 text-prod", className)} aria-label="Deployed" />;
  if (status === "failed") return <CircleX className={clsx("size-3.5 text-danger", className)} aria-label="Failed" />;
  return <CircleX className={clsx("size-3.5 text-muted", className)} aria-label={status} />;
}

const STATUS_WORD: Record<string, string> = {
  queued: "Queued",
  in_progress: "Building",
  finished: "Deployed",
  failed: "Failed",
  "cancelled-by-user": "Cancelled",
};
export const statusWord = (s: string | undefined) => (s ? (STATUS_WORD[s] ?? s) : "Never deployed");

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };
  return { copied, copy };
}

export function CopyButton({ text, label, size = "sm" }: { text: string; label: string; size?: "sm" | "md" }) {
  const { copied, copy } = useCopy();
  return (
    <Button size={size} onClick={() => copy("x", text)} aria-live="polite">
      {copied ? <Check className="size-3.5 text-prod" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

const inputClass = "field h-9 w-full rounded-lg bg-surface px-3 text-[13.5px] outline-none placeholder:text-muted";

/* ---------------- add a Coolify instance ---------------- */

export function AddCoolifyDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded?: (id: number) => void }) {
  const add = useAddCoolify();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [access, setAccess] = useState(false);
  const [cfId, setCfId] = useState("");
  const [cfSecret, setCfSecret] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(
      {
        name: name.trim() || url.replace(/^https?:\/\//, ""),
        url,
        token,
        ...(access && cfId && cfSecret ? { cfAccessClientId: cfId.trim(), cfAccessClientSecret: cfSecret.trim() } : {}),
      },
      {
        onSuccess: ({ instance }) => {
          toast.success(`Connected to ${instance.name}`, {
            description: [instance.version && `Coolify ${instance.version}`, instance.appCount !== null && `${instance.appCount} apps found`].filter(Boolean).join(" · ") || undefined,
          });
          setName("");
          setUrl("");
          setToken("");
          setCfId("");
          setCfSecret("");
          onOpenChange(false);
          onAdded?.(instance.id);
        },
        onError: (err) => toast.error("Couldn't connect", { description: err.message }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Connect a Coolify instance" description="Oche checks the token works before saving it. Tokens are stored encrypted.">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Coolify URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://coolify.example.com" className={inputClass} required autoComplete="off" spellCheck={false} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hetzner main" className={inputClass} maxLength={60} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-ink-2">API token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="12|xxxxxxxxxxxxxxxx"
            className={clsx(inputClass, "font-mono")}
            type="password"
            required
            autoComplete="off"
          />
        </label>
        <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
          In Coolify: <span className="font-medium">Keys & Tokens → API tokens</span>. Give it <span className="font-mono text-[12px]">read</span>,{" "}
          <span className="font-mono text-[12px]">read:sensitive</span> (for build logs), <span className="font-mono text-[12px]">write</span> (for setup) and{" "}
          <span className="font-mono text-[12px]">deploy</span>. On a self-hosted Coolify, API access must be on under Settings → Advanced.
        </p>
        <AccessFields open={access} onOpen={setAccess} id={cfId} secret={cfSecret} onId={setCfId} onSecret={setCfSecret} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={add.isPending}>
            Connect
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Cloudflare Access service token, for a Coolify behind Access. */
export function AccessFields({
  open,
  onOpen,
  id,
  secret,
  onId,
  onSecret,
  hint,
}: {
  open: boolean;
  onOpen: (o: boolean) => void;
  id: string;
  secret: string;
  onId: (v: string) => void;
  onSecret: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-2">
        <input type="checkbox" checked={open} onChange={(e) => onOpen(e.target.checked)} className="size-3.5 accent-[var(--ember)]" />
        Coolify is behind Cloudflare Access
      </label>
      {open && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[12px] leading-relaxed text-muted">
            In Cloudflare Zero Trust, create a service token (Access → Service credentials) and add a policy to the Coolify application with action{" "}
            <span className="font-medium text-ink-2">Service Auth</span> that includes it. {hint}
          </p>
          <input value={id} onChange={(e) => onId(e.target.value)} placeholder="Client ID (….access)" className={clsx(inputClass, "font-mono")} autoComplete="off" spellCheck={false} />
          <input value={secret} onChange={(e) => onSecret(e.target.value)} placeholder="Client secret" type="password" className={clsx(inputClass, "font-mono")} autoComplete="off" />
        </div>
      )}
    </div>
  );
}

/* ---------------- repo: not linked ---------------- */

function ConnectCoolify({ repo, canEdit }: { repo: ApiRepo; canEdit: boolean }) {
  const instances = useCoolifyInstances();
  const link = useLinkCoolify(repo.fullName);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<number | "">("");
  const list = instances.data?.instances ?? [];

  const doLink = (id: number) =>
    link.mutate(id, {
      onSuccess: (r) =>
        r.matched.length
          ? toast.success(`Found ${r.matched.length} app${r.matched.length === 1 ? "" : "s"} for ${repo.name}`)
          : toast(`Linked. No apps on that Coolify build ${repo.name} from its branches yet.`, { description: "Use Set up on Coolify to create them." }),
      onError: (e) => toast.error("Couldn't link", { description: e.message }),
    });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-[14px] font-semibold">Deployments</h2>
          <p className="mt-1 text-[13px] text-muted">
            Link the Coolify that runs {repo.name}. Oche finds the apps building it from {repo.branches?.dev}, {repo.branches?.staging} and {repo.branches?.prod}, and
            shows their builds here.
          </p>
        </div>
        {canEdit && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {list.length > 0 && (
              <>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value ? Number(e.target.value) : "")}
                  className="field h-9 min-w-0 flex-1 rounded-lg bg-surface px-2.5 text-[13px] outline-none sm:w-56 sm:flex-none"
                  aria-label="Coolify instance"
                >
                  <option value="">Choose a Coolify…</option>
                  {list.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <Button variant="primary" disabled={choice === ""} loading={link.isPending} onClick={() => choice !== "" && doLink(choice)}>
                  Link
                </Button>
              </>
            )}
            <Button variant={list.length ? "ghost" : "primary"} onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> {list.length ? "New" : "Connect Coolify"}
            </Button>
          </div>
        )}
      </div>
      <AddCoolifyDialog open={adding} onOpenChange={setAdding} onAdded={doLink} />
    </Card>
  );
}

/* ---------------- repo: linked ---------------- */

const STAGES: Stage[] = ["dev", "staging", "prod"];

export function DeploymentsSection({ repo }: { repo: ApiRepo }) {
  const q = useDeployments(repo.fullName);
  const me = useMe();
  const isOwner = me.data?.role === "owner";
  const unlink = useUnlinkCoolify(repo.fullName);
  const [setupOpen, setSetupOpen] = useState(false);
  const [logs, setLogs] = useState<{ app: ApiCoolifyApp; deployment: ApiDeployment; explain?: boolean } | null>(null);

  if (q.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!q.data?.instance) {
    if (q.isError) return <Card className="p-5 text-[13px] text-danger">{q.error.message}</Card>;
    return <ConnectCoolify repo={repo} canEdit={isOwner} />;
  }

  const { instance, apps } = q.data;
  const failed = apps.filter((a) => a.deployments[0]?.status === "failed");

  return (
    <section aria-labelledby="deployments" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="deployments" className="flex items-center gap-2 text-[13px] font-medium text-muted">
          Deployments
          <a href={instance.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-normal hover:text-ink">
            on {instance.name} <ExternalLink className="size-3" />
          </a>
        </h2>
        {isOwner && (
          <div className="flex items-center gap-2">
            {apps.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSetupOpen(true)}>
                <Plus className="size-3.5" /> Add apps
              </Button>
            )}
            <Menu.Root>
              <Menu.Trigger className="pressable grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label="Coolify options">
                <MoreHorizontal className="size-4" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={6} align="end" className="z-50">
                  <Menu.Popup className="popup min-w-48 rounded-xl bg-surface p-1 shadow-pop outline-none">
                    <Menu.Item
                      onClick={() => unlink.mutate(undefined, { onSuccess: () => toast(`Unlinked ${instance.name}`) })}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-highlighted:bg-surface-2"
                    >
                      <Unlink className="size-3.5 text-muted" /> Unlink {instance.name}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        )}
      </div>

      {q.isError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{q.error.message}</p>}

      {failed.map((app) => (
        <FailureBanner key={app.uuid} repo={repo} app={app} deployment={app.deployments[0]!} onExplain={() => setLogs({ app, deployment: app.deployments[0]!, explain: true })} />
      ))}

      {apps.length === 0 ? (
        <Card>
          <Empty
            title={`Nothing on ${instance.name} builds ${repo.name} yet`}
            action={
              isOwner && (
                <Button variant="primary" onClick={() => setSetupOpen(true)}>
                  Set up on Coolify
                </Button>
              )
            }
          >
            Oche creates a project with production, staging and development environments, an app per environment on {repo.branches?.prod},{" "}
            {repo.branches?.staging} and {repo.branches?.dev}, and a database for each.
            {q.data.otherBranches.length > 0 && ` (${q.data.otherBranches.length} app${q.data.otherBranches.length === 1 ? "" : "s"} build other branches.)`}
          </Empty>
          {q.data.sameName.length > 0 && (
            <div className="mx-5 mb-5 rounded-lg bg-staging/12 px-3 py-2.5 text-[12.5px] text-ink-2">
              <p className="font-medium">Did {repo.name} move? These apps build a repo with the same name:</p>
              <ul className="mt-1 space-y-0.5 font-mono text-[12px]">
                {q.data.sameName.map((a) => (
                  <li key={a.uuid}>
                    {a.name} · {a.repo} @ {a.branch}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">Point them at {repo.fullName} in Coolify (the app's Git Source) and they'll show up here.</p>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <Card key={stage} className="overflow-hidden">
              <h3 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px] font-medium">
                <StageDot stage={stage} /> {STAGE_LABEL[stage]}
              </h3>
              <ul className="divide-y divide-line">
                {apps
                  .filter((a) => a.stage === stage)
                  .map((app) => (
                    <AppRow key={app.uuid} repo={repo} app={app} onLogs={(deployment) => setLogs({ app, deployment })} />
                  ))}
                {!apps.some((a) => a.stage === stage) && <li className="px-4 py-4 text-[12.5px] text-muted">No app builds {repo.branches?.[stage]}.</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {logs && <LogsDialog repo={repo} app={logs.app} deployment={logs.deployment} explainNow={logs.explain} onClose={() => setLogs(null)} />}
      {setupOpen && <CoolifySetupDialog repo={repo} open onOpenChange={setSetupOpen} />}
    </section>
  );
}

function AppRow({ repo, app, onLogs }: { repo: ApiRepo; app: ApiCoolifyApp; onLogs: (d: ApiDeployment) => void }) {
  const last = app.deployments[0];
  const redeploy = useRedeploy(repo.fullName);
  const run = (force: boolean) =>
    redeploy.mutate(
      { app: app.uuid, force },
      {
        onSuccess: () => toast.success(`${force ? "Rebuilding" : "Redeploying"} ${app.name}`),
        onError: (e) => toast.error("Couldn't start the deployment", { description: e.message }),
      },
    );
  const running = app.state === "running";
  const [rollingBack, setRollingBack] = useState(false);

  return (
    <li className="px-4 py-3">
      {rollingBack && <RollbackDialog repo={repo} app={app} onClose={() => setRollingBack(false)} />}
      <div className="flex items-center gap-2">
        <DeployIcon status={last?.status} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{app.name}</span>
        <Badge tone={running ? (app.health === "unhealthy" ? "warn" : "ok") : "danger"} className="capitalize">
          {app.state}
        </Badge>
      </div>
      <p className="mt-1 truncate pl-5.5 text-[12px] text-muted">
        {statusWord(last?.status)}
        {last && ` ${ago(last.updatedAt)}`}
        {last?.commit && <span className="font-mono"> · {last.commit.slice(0, 7)}</span>}
      </p>
      {app.fqdn && (
        <a href={app.fqdn.split(",")[0]} target="_blank" rel="noreferrer" className="mt-0.5 block truncate pl-5.5 text-[12px] text-ink-2 hover:underline">
          {app.fqdn.split(",")[0]!.replace(/^https?:\/\//, "")}
        </a>
      )}
      <div className="mt-2.5 flex gap-1.5 pl-5.5">
        {last && (
          <Button size="sm" onClick={() => onLogs(last)}>
            <SquareTerminal className="size-3.5" /> Logs
          </Button>
        )}
        <Menu.Root>
          <Menu.Trigger
            disabled={redeploy.isPending || (last ? isActive(last.status) : false)}
            className="pressable inline-flex h-7 items-center gap-1.5 rounded-md bg-surface px-2.5 text-[13px] font-medium shadow-card hover:bg-surface-2 disabled:opacity-50"
          >
            {redeploy.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />} Redeploy
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="start" className="z-50">
              <Menu.Popup className="popup min-w-52 rounded-xl bg-surface p-1 shadow-pop outline-none">
                <Menu.Item onClick={() => run(false)} className="block rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-highlighted:bg-surface-2">
                  Redeploy
                </Menu.Item>
                <Menu.Item onClick={() => run(true)} className="block rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-highlighted:bg-surface-2">
                  Rebuild without cache
                </Menu.Item>
                <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                <Menu.Item onClick={() => setRollingBack(true)} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-highlighted:bg-surface-2">
                  <History className="size-3.5 text-muted" /> Roll back…
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </li>
  );
}

function FailureBanner({ repo, app, deployment, onExplain }: { repo: ApiRepo; app: ApiCoolifyApp; deployment: ApiDeployment; onExplain: () => void }) {
  const detail = useDeploymentDetail(repo.fullName, app.uuid, deployment.uuid, false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/8 px-4 py-3 text-[13px]">
      <CircleX className="size-4 shrink-0 text-danger" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          {app.name} ({STAGE_LABEL[app.stage].toLowerCase()}) failed to deploy {ago(deployment.updatedAt)}.
        </span>{" "}
        <span className="text-ink-2">Copy the report into Claude or ChatGPT, or let Oche explain it.</span>
      </p>
      <div className="flex gap-1.5">
        {detail.data ? <CopyButton text={detail.data.report} label="Copy report" /> : <Button size="sm" loading>Copy report</Button>}
        <Button size="sm" onClick={onExplain}>
          <Sparkles className="size-3.5" /> Explain
        </Button>
      </div>
    </div>
  );
}

/* ---------------- rollback ---------------- */

function RollbackDialog({ repo, app, onClose }: { repo: ApiRepo; app: ApiCoolifyApp; onClose: () => void }) {
  const q = useRollbackOptions(repo.fullName, app.uuid);
  const rollback = useRollback(repo.fullName);
  const [picked, setPicked] = useState<string | null>(null);
  const images = q.data?.images ?? [];
  const lastGood = images.find((i) => !i.isCurrent);

  useEffect(() => {
    if (lastGood && picked === null) setPicked(lastGood.tag);
  }, [lastGood, picked]);

  const go = () =>
    picked &&
    rollback.mutate(
      { app: app.uuid, commit: picked },
      {
        onSuccess: () => {
          toast.success(`Rolling ${app.name} back to ${picked.slice(0, 7)}`, { description: "Follow it in the app's logs." });
          onClose();
        },
        onError: (e) => toast.error("Couldn't roll back", { description: e.message }),
      },
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Roll back ${app.name}`}
      description="Runs an older image Coolify still has, with today's settings and env vars. It doesn't undo database migrations or restore data."
    >
      {q.isLoading ? (
        <Skeleton className="h-28" />
      ) : q.isError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{q.error.message}</p>
      ) : images.length < 2 ? (
        <p className="text-[13px] text-muted">Coolify has no older image for {app.name} to go back to. Coolify keeps a set number of images per app; raise it under the app's Advanced settings.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {images.map((i) => (
            <li key={i.tag}>
              <label
                className={clsx(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-[13px]",
                  picked === i.tag ? "bg-surface-2" : "hover:bg-surface-2",
                  i.isCurrent && "cursor-default opacity-60",
                )}
              >
                <input type="radio" name="image" disabled={i.isCurrent} checked={picked === i.tag} onChange={() => setPicked(i.tag)} className="mt-1 accent-[var(--ember)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px]">{i.tag.slice(0, 7)}</span>
                    {i.isCurrent && <Badge tone="ok">Running now</Badge>}
                    {!i.isCurrent && i === lastGood && <Badge>Previous</Badge>}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {i.commitMessage?.split("\n")[0] ?? "No deployment record"} · built {ago(i.createdAt)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!picked || images.length < 2} loading={rollback.isPending} onClick={go}>
          Roll back to {picked?.slice(0, 7) ?? "…"}
        </Button>
      </div>
    </Dialog>
  );
}

/* ---------------- logs ---------------- */

export function LogsDialog({
  repo,
  app,
  deployment,
  explainNow = false,
  onClose,
}: {
  repo: ApiRepo;
  app: ApiCoolifyApp;
  deployment: ApiDeployment;
  explainNow?: boolean;
  onClose: () => void;
}) {
  const [live, setLive] = useState(isActive(deployment.status));
  const q = useDeploymentDetail(repo.fullName, app.uuid, deployment.uuid, live);
  const explain = useExplain(repo.fullName, app.uuid, deployment.uuid);
  const [showHidden, setShowHidden] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const status = q.data?.deployment.status ?? deployment.status;
  const failed = status === "failed";

  useEffect(() => {
    if (q.data && !isActive(q.data.deployment.status)) setLive(false);
  }, [q.data]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [q.data?.lines.length]);
  const asked = useRef(false);
  useEffect(() => {
    if (explainNow && !asked.current) {
      asked.current = true;
      explain.mutate();
    }
  }, [explainNow, explain]);

  const lines = (q.data?.lines ?? []).filter((l) => showHidden || !l.hidden);
  const fullLog = (q.data?.lines ?? []).filter((l) => !l.hidden).map((l) => l.output).join("\n");

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <DeployIcon status={status} /> {app.name} <span className="font-normal text-muted">· {STAGE_LABEL[app.stage]}</span>
        </span>
      }
      description={
        <>
          {statusWord(status)} {ago(q.data?.deployment.updatedAt ?? deployment.updatedAt)}
          {deployment.commit && <span className="font-mono"> · {deployment.commit.slice(0, 7)}</span>}
          {deployment.commitMessage && ` · ${deployment.commitMessage.split("\n")[0]}`}
        </>
      }
    >
      <div className="overflow-hidden rounded-xl bg-[#0f0e0d] ring-1 ring-black/5 dark:ring-white/5">
        <div className="max-h-[52vh] min-h-48 overflow-auto p-3 font-mono text-[12px] leading-[1.55] text-[#e8e2da]">
          {q.isLoading && <p className="text-[#8f877f]">Loading the build log…</p>}
          {q.isError && <p className="text-[#ff8a70]">{q.error.message}</p>}
          {lines.map((l, i) => (
            <div key={i} className={clsx("break-words whitespace-pre-wrap", l.type === "stderr" && "text-[#ff8a70]", l.hidden && "text-[#8f877f]")}>
              {l.command && l.hidden ? <span className="text-[#8f877f]">$ {l.command}</span> : l.output}
            </div>
          ))}
          {live && (
            <div className="mt-1 flex items-center gap-2 text-[#8f877f]">
              <Loader2 className="size-3 animate-spin" /> building…
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {explain.data && (
        <div className="mt-3 rounded-xl bg-surface-2 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
            <Sparkles className="size-3.5 text-ember" /> What went wrong
          </p>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{explain.data.explanation}</div>
        </div>
      )}
      {explain.isPending && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 p-4 text-[13px] text-muted">
          <Loader2 className="size-3.5 animate-spin" /> Reading the log…
        </p>
      )}
      {explain.isError && <p className="mt-3 text-[13px] text-danger">{explain.error.message}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="mr-auto inline-flex items-center gap-2 text-[12.5px] text-muted">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="accent-[var(--ember)]" />
          Show Coolify's own commands
        </label>
        <a
          href={app.coolifyUrl}
          target="_blank"
          rel="noreferrer"
          className="pressable inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
        >
          Coolify <ExternalLink className="size-3" />
        </a>
        {q.data && <CopyButton text={fullLog} label="Copy log" />}
        {q.data && <CopyButton text={q.data.report} label={failed ? "Copy report" : "Copy summary"} />}
        {failed && !explain.data && (
          <Button size="sm" variant="primary" loading={explain.isPending} onClick={() => explain.mutate()}>
            {!explain.isPending && <Sparkles className="size-3.5" />} Explain
          </Button>
        )}
      </div>
    </Dialog>
  );
}

/** A line under each pipeline stage: which apps built what, and how it went. */
export function StageDeploys({ repo, stage }: { repo: ApiRepo; stage: Stage }): ReactNode {
  const q = useDeployments(repo.fullName);
  const apps = q.data?.apps.filter((a) => a.stage === stage) ?? [];
  if (!apps.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-line pt-2.5">
      {apps.map((a) => {
        const last = a.deployments[0];
        return (
          <li key={a.uuid} className="flex items-center gap-1.5 text-[12px] text-muted">
            <DeployIcon status={last?.status} className="size-3" />
            <span className="truncate text-ink-2">{a.name}</span>
            <span className="ml-auto shrink-0">
              {statusWord(last?.status).toLowerCase()}
              {last && !isActive(last.status) ? ` ${ago(last.updatedAt)}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
