import clsx from "clsx";
import { AlertTriangle, Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ApiRepo, BuildPack, CoolifySetupRequest, CoolifySetupResult, Stage } from "../lib/api-types.ts";
import { useRunSetup, useSetupPlan } from "../lib/queries.ts";
import { Button, Dialog, Select, Skeleton, STAGE_LABEL, StageDot, type SelectOption } from "./ui.tsx";

type AppDraft = CoolifySetupRequest["apps"][number] & { touched: Partial<Record<Stage, boolean>> };

/** api.x.com → apidev.x.com and sandbox.x.com. Mirrors server/src/coolify/match.ts. */
export function suggestDomains(prodHost: string, index = 0): Record<Stage, string> {
  const host = prodHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  if (!host) return { prod: "", dev: "", staging: "" };
  const dot = host.indexOf(".");
  if (dot === -1) return { prod: host, dev: `${host}dev`, staging: index === 0 ? "sandbox" : `${host}sandbox` };
  const sub = host.slice(0, dot);
  const rest = host.slice(dot + 1);
  if (!rest.includes(".")) return { prod: host, dev: `dev.${host}`, staging: index === 0 ? `sandbox.${host}` : `sandbox-${index}.${host}` };
  return { prod: host, dev: `${sub}dev.${rest}`, staging: index === 0 ? `sandbox.${rest}` : `${sub}sandbox.${rest}` };
}

const BUILD_PACKS: SelectOption<BuildPack>[] = [
  { value: "nixpacks", label: "Nixpacks" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "dockercompose", label: "Compose" },
  { value: "static", label: "Static" },
];

const field = "field h-8 w-full min-w-0 rounded-lg bg-surface px-2.5 text-[13px] outline-none placeholder:text-muted";
const STAGES: Stage[] = ["prod", "staging", "dev"];

export function CoolifySetupDialog({ repo, open, onOpenChange }: { repo: ApiRepo; open: boolean; onOpenChange: (o: boolean) => void }) {
  const plan = useSetupPlan(repo.fullName, open);
  const run = useRunSetup(repo.fullName);
  const [projectName, setProjectName] = useState("");
  const [serverUuid, setServerUuid] = useState("");
  const [githubAppUuid, setGithubAppUuid] = useState("");
  const [apps, setApps] = useState<AppDraft[]>([]);
  const [postgres, setPostgres] = useState(true);
  const [redis, setRedis] = useState(false);
  const [deploy, setDeploy] = useState(true);
  const [result, setResult] = useState<CoolifySetupResult | null>(null);

  useEffect(() => {
    const p = plan.data;
    if (!p) return;
    setProjectName(p.projectName);
    setServerUuid(p.servers.find((s) => s.usable)?.uuid ?? p.servers[0]?.uuid ?? "");
    setGithubAppUuid((p.githubApps.find((g) => g.canSeeRepo) ?? p.githubApps[0])?.uuid ?? "");
    setApps(p.detected.map((d) => ({ name: d.name, baseDirectory: d.baseDirectory, buildPack: d.buildPack, port: d.port, domains: { prod: "", staging: "", dev: "" }, touched: {} })));
  }, [plan.data]);

  const update = (i: number, patch: Partial<AppDraft>) => setApps((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const setProd = (i: number, host: string) =>
    setApps((list) =>
      list.map((a, j) => {
        if (j !== i) return a;
        const s = suggestDomains(host, i);
        return { ...a, domains: { prod: host, staging: a.touched.staging ? a.domains.staging : s.staging, dev: a.touched.dev ? a.domains.dev : s.dev } };
      }),
    );

  const gh = plan.data?.githubApps.find((g) => g.uuid === githubAppUuid);
  const ready = projectName.trim() && serverUuid && githubAppUuid && apps.length > 0 && apps.every((a) => a.name.trim() && a.port.trim());

  const submit = () =>
    run.mutate(
      {
        projectName: projectName.trim(),
        serverUuid,
        githubAppUuid,
        apps: apps.map(({ touched: _t, ...a }) => a),
        databases: { postgres, redis },
        deploy,
      },
      {
        onSuccess: (r) => {
          setResult(r);
          const bad = r.steps.filter((s) => !s.ok).length;
          if (bad) toast.error(`Setup finished with ${bad} problem${bad === 1 ? "" : "s"}`);
          else toast.success(`${repo.name} is set up on Coolify`, { description: deploy ? "The first deployments are running." : undefined });
        },
        onError: (e) => toast.error("Setup failed", { description: e.message }),
      },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={result ? "Setup finished" : `Set up ${repo.name} on Coolify`}
      description={
        result
          ? undefined
          : `A project with production, staging and development environments. Each app is created three times, on ${repo.branches?.prod}, ${repo.branches?.staging} and ${repo.branches?.dev}.`
      }
    >
      {result ? (
        <SetupResult result={result} onDone={() => onOpenChange(false)} />
      ) : plan.isError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{plan.error.message}</p>
      ) : !plan.data ? (
        <div className="space-y-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-24" />
          <p className="text-[12.5px] text-muted">Reading your Coolify and looking through the repo for apps…</p>
        </div>
      ) : (
        <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-2">Project</span>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={field} />
              {plan.data.existingProject && <span className="mt-1 block text-[11.5px] text-muted">Exists already; Oche adds to it.</span>}
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-2">Server</span>
              <Select
                value={serverUuid}
                onChange={setServerUuid}
                aria-label="Server"
                options={plan.data.servers.map((s) => ({ value: s.uuid, label: s.name, hint: s.ip }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-2">GitHub source</span>
              <Select
                value={githubAppUuid}
                onChange={setGithubAppUuid}
                aria-label="GitHub source"
                placeholder="No sources"
                options={plan.data.githubApps.map((g) => ({
                  value: g.uuid,
                  label: g.organization ? `${g.name} (${g.organization})` : g.name,
                  hint: g.canSeeRepo === false ? `Can't see ${repo.name}` : undefined,
                }))}
              />
            </label>
          </div>
          {gh?.canSeeRepo === false && (
            <p className="flex items-start gap-2 rounded-lg bg-staging/12 px-3 py-2 text-[12.5px] text-ink-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-staging" />
              {gh.name} doesn't have access to {repo.fullName}. Add the repo to that GitHub App's installation, or pick another source.
            </p>
          )}
          {plan.data.githubApps.length === 0 && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">This Coolify has no GitHub App source. Add one under Sources in Coolify first.</p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12.5px] font-medium text-ink-2">Apps</h3>
              <button
                onClick={() => setApps((l) => [...l, { name: `${repo.name}-${l.length + 1}`, baseDirectory: "/", buildPack: "nixpacks", port: "3000", domains: { prod: "", staging: "", dev: "" }, touched: {} }])}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink"
              >
                <Plus className="size-3.5" /> Add app
              </button>
            </div>
            <div className="space-y-3">
              {apps.map((a, i) => (
                <div key={i} className="rounded-xl bg-surface-2 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_0.6fr_auto]">
                    <input value={a.name} onChange={(e) => update(i, { name: e.target.value })} className={field} aria-label="App name" placeholder="api" />
                    <input value={a.baseDirectory} onChange={(e) => update(i, { baseDirectory: e.target.value })} className={clsx(field, "font-mono")} aria-label="Base directory" placeholder="/" />
                    <Select value={a.buildPack} onChange={(buildPack) => update(i, { buildPack })} aria-label="Build pack" options={BUILD_PACKS} />
                    <input value={a.port} onChange={(e) => update(i, { port: e.target.value })} className={clsx(field, "font-mono")} aria-label="Port" placeholder="3000" />
                    <button
                      onClick={() => setApps((l) => l.filter((_, j) => j !== i))}
                      disabled={apps.length === 1}
                      className="pressable grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-danger disabled:opacity-30"
                      aria-label={`Remove ${a.name}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {STAGES.map((stage) => (
                      <label key={stage} className="flex items-center gap-2">
                        <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-[12px] text-muted">
                          <StageDot stage={stage} /> {STAGE_LABEL[stage]}
                        </span>
                        <input
                          value={a.domains[stage]}
                          onChange={(e) =>
                            stage === "prod"
                              ? setProd(i, e.target.value)
                              : update(i, { domains: { ...a.domains, [stage]: e.target.value }, touched: { ...a.touched, [stage]: true } })
                          }
                          placeholder={stage === "prod" ? "api.example.com (optional)" : "suggested from production"}
                          className={clsx(field, "font-mono")}
                          spellCheck={false}
                        />
                      </label>
                    ))}
                  </div>
                  {plan.data.detected[i] && <p className="mt-1.5 text-[11.5px] text-muted">Found {plan.data.detected[i]!.why}.</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            <Toggle checked={postgres} onChange={setPostgres} label="Postgres per environment" hint="sets DATABASE_URL" />
            <Toggle checked={redis} onChange={setRedis} label="Redis per environment" hint="sets REDIS_URL" />
            <Toggle checked={deploy} onChange={setDeploy} label="Deploy when done" />
          </div>
        </div>
      )}

      {!result && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!ready} loading={run.isPending}>
            {run.isPending ? "Setting up…" : `Create ${apps.length * 3} app${apps.length * 3 === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </Dialog>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[var(--ember)]" />
      {label}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

function SetupResult({ result, onDone }: { result: CoolifySetupResult; onDone: () => void }) {
  return (
    <>
      <ol className="max-h-[52vh] space-y-1.5 overflow-y-auto">
        {result.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            {s.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-prod" /> : <X className="mt-0.5 size-3.5 shrink-0 text-danger" />}
            <span>
              {s.label}
              {s.detail && <span className="block text-[12px] text-danger">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
