import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, Card, Dialog, githubAvatar, LinkButton, Skeleton } from "../components/ui.tsx";
import { AccessFields, AddCoolifyDialog, CopyButton } from "../components/coolify.tsx";
import type { ApiCoolifyInstance } from "../lib/api-types.ts";
import { API_URL } from "../lib/api.ts";
import { ago } from "../lib/time.ts";
import {
  useCheckCoolify,
  useEnableAlerts,
  useCoolifyInstances,
  useCreateToken,
  useRemoveCoolify,
  useUpdateCoolify,
  useDeleteToken,
  useInstallations,
  useInvite,
  useMe,
  useMembers,
  useRemoveMember,
  useTokens,
} from "../lib/queries.ts";

export function SettingsPage() {
  const me = useMe();
  const isOwner = me.data?.role === "owner";
  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">Settings</h1>
      <Accounts />
      {isOwner && <CoolifyInstances />}
      {isOwner && <Members />}
      <Tokens />
    </div>
  );
}

function Section({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const inputClass =
  "h-9 min-w-0 flex-1 field rounded-lg bg-surface px-3 text-[13.5px] outline-none placeholder:text-muted";

/* ---------------- accounts ---------------- */

function Accounts() {
  const q = useInstallations();
  return (
    <Section
      title="Accounts and orgs"
      description="Where the Oche app is installed. Repos from these show up on Projects."
      action={
        q.data?.installUrl && (
          <LinkButton href={q.data.installUrl} target="_blank" rel="noreferrer" size="sm">
            <Plus className="size-3.5" /> Add account or org
          </LinkButton>
        )
      }
    >
      <Card className="divide-y divide-line">
        {q.isLoading && <Skeleton className="m-4 h-5 w-1/2" />}
        {q.data?.installations.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar src={i.avatarUrl} alt={i.account} size={28} className="rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13.5px] font-medium">
                {i.account}
                {i.type === "Organization" && <Badge>Org</Badge>}
                {i.suspended && <Badge tone="danger">Suspended</Badge>}
              </p>
              <p className="text-[12.5px] text-muted">
                {i.managed} of {i.repos} repo{i.repos === 1 ? "" : "s"} guarded
              </p>
            </div>
            <a href={i.settingsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
              Repo access <ExternalLink className="size-3" />
            </a>
          </div>
        ))}
        {q.data && q.data.installations.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-muted">Not installed anywhere yet.</p>
        )}
      </Card>
    </Section>
  );
}

/* ---------------- coolify ---------------- */

function CoolifyInstances() {
  const q = useCoolifyInstances();
  const remove = useRemoveCoolify();
  const check = useCheckCoolify();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ApiCoolifyInstance | null>(null);

  return (
    <Section
      title="Coolify"
      description="The Coolify instances your repos deploy on. Link each repo to one from its page; repos on the same Coolify share a connection."
      action={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Connect Coolify
        </Button>
      }
    >
      <Card className="divide-y divide-line">
        {q.isLoading && <Skeleton className="m-4 h-5 w-1/2" />}
        {q.data?.instances.map((i) => (
          <div key={i.id} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-medium">{i.name}</span>
              {i.version && <Badge>v{i.version}</Badge>}
              {i.cloudflareAccess && <Badge>Cloudflare Access</Badge>}
              {i.lastError ? <Badge tone="danger">Can't connect</Badge> : <Badge tone="ok">Connected</Badge>}
              <span className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={check.isPending && check.variables === i.id}
                  onClick={() =>
                    check.mutate(i.id, {
                      onSuccess: ({ instance }) =>
                        instance.lastError
                          ? toast.error(`${instance.name} isn't reachable`, { description: instance.lastError })
                          : toast.success(`${instance.name} is connected`, { description: `${instance.appCount ?? 0} apps found` }),
                    })
                  }
                >
                  Check
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                  Edit
                </Button>
                <RemoveButton label={`Remove ${i.name}`} onConfirm={() => remove.mutate(i.id, { onSuccess: () => toast(`Removed ${i.name}`) })} />
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
              <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                {i.url} <ExternalLink className="size-3" />
              </a>
              <span aria-hidden>·</span>
              <span>{i.appCount === null ? "apps not checked yet" : `${i.appCount} app${i.appCount === 1 ? "" : "s"} on Coolify`}</span>
              <span aria-hidden>·</span>
              <span>
                {i.linkedRepos} linked repo{i.linkedRepos === 1 ? "" : "s"}
              </span>
            </p>
            {i.lastError && <p className="mt-1.5 line-clamp-3 rounded-lg bg-danger/8 px-3 py-2 text-[12.5px] text-danger">{i.lastError}</p>}
            <Alerts instance={i} />
          </div>
        ))}
        {q.data?.instances.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted">No Coolify connected yet.</p>}
      </Card>
      <AddCoolifyDialog open={adding} onOpenChange={setAdding} />
      {editing && <EditCoolifyDialog instance={editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

/** Coolify's team webhook, which Oche can point at itself. */
function Alerts({ instance: i }: { instance: ApiCoolifyInstance }) {
  const enable = useEnableAlerts();
  const [manual, setManual] = useState(false);
  const turnOn = (replace: boolean) =>
    enable.mutate(
      { id: i.id, replace },
      {
        onSuccess: () => toast.success(`Deploy alerts on for ${i.name}`),
        onError: (e) => toast.error("Couldn't set the webhook", { description: e.message }),
      },
    );
  return (
    <div className="mt-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-medium text-ink-2">Deploy alerts</span>
        {i.alerts === "on" ? (
          <Badge tone="ok">On</Badge>
        ) : i.alerts === "other" ? (
          <Badge tone="warn">Webhook used elsewhere</Badge>
        ) : (
          <Badge>Off</Badge>
        )}
        <span className="text-muted">
          {i.alerts === "on"
            ? "Coolify tells Oche the moment a deploy finishes or fails."
            : i.alerts === "other"
              ? "This Coolify's webhook sends somewhere else. Coolify has one webhook per team."
              : "Oche can set Coolify's webhook for you."}
        </span>
        <span className="ml-auto flex gap-1.5">
          {i.alerts !== "on" && (
            <Button size="sm" variant={i.alerts === "other" ? "secondary" : "primary"} loading={enable.isPending} onClick={() => turnOn(i.alerts === "other")}>
              {i.alerts === "other" ? "Replace with Oche" : "Turn on"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setManual((m) => !m)}>
            {manual ? "Hide URL" : "URL"}
          </Button>
        </span>
      </div>
      {manual && (
        <div className="mt-2 flex items-start gap-2">
          <code className="min-w-0 flex-1 font-mono text-[12px] break-all">{i.webhookUrl}</code>
          <CopyButton text={i.webhookUrl} label="Copy" />
        </div>
      )}
    </div>
  );
}

function EditCoolifyDialog({ instance, onClose }: { instance: ApiCoolifyInstance; onClose: () => void }) {
  const update = useUpdateCoolify();
  const [name, setName] = useState(instance.name);
  const [token, setToken] = useState("");
  const [access, setAccess] = useState(instance.cloudflareAccess);
  const [cfId, setCfId] = useState("");
  const [cfSecret, setCfSecret] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const accessChange =
      access && cfId && cfSecret
        ? { cfAccessClientId: cfId.trim(), cfAccessClientSecret: cfSecret.trim() }
        : !access && instance.cloudflareAccess
          ? { cfAccessClientId: null }
          : {};
    update.mutate(
      { id: instance.id, ...(name.trim() !== instance.name ? { name: name.trim() } : {}), ...(token.trim() ? { token: token.trim() } : {}), ...accessChange },
      {
        onSuccess: ({ instance: saved }) => {
          toast.success(`Saved ${saved.name}`, { description: saved.appCount !== null ? `${saved.appCount} apps found` : undefined });
          onClose();
        },
        onError: (err) => toast.error("That didn't connect", { description: err.message }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit ${instance.name}`} description="Oche checks the connection before saving any change to it.">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-full`} maxLength={60} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-ink-2">New API token</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Leave empty to keep the current one" className={`${inputClass} w-full font-mono`} autoComplete="off" />
        </label>
        <AccessFields
          open={access}
          onOpen={setAccess}
          id={cfId}
          secret={cfSecret}
          onId={setCfId}
          onSecret={setCfSecret}
          hint={instance.cloudflareAccess ? "Leave both empty to keep the saved token." : undefined}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------- members ---------------- */

function Members() {
  const q = useMembers(true);
  const invite = useInvite();
  const remove = useRemoveMember();
  const [login, setLogin] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = login.trim().replace(/^@/, "");
    if (!value) return;
    invite.mutate(value, {
      onSuccess: () => {
        toast.success(`Added ${value}`, { description: "They can sign in with GitHub now. Promoting a repo needs write access to it." });
        setLogin("");
      },
      onError: (err) => toast.error("Couldn't add them", { description: err.message }),
    });
  };

  return (
    <Section
      title="People"
      description="Who can sign in. Members see only the repos they can reach on GitHub, and the accounts and orgs those belong to. They can promote and ship where they have write access; only you can set repos up or change settings."
    >
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="GitHub username" className={inputClass} aria-label="GitHub username" autoComplete="off" spellCheck={false} />
        <Button type="submit" loading={invite.isPending} disabled={!login.trim()}>
          Add
        </Button>
      </form>
      <Card className="divide-y divide-line">
        {q.data?.members.map((m) => (
          <div key={m.login} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar src={m.avatarUrl} alt={m.login} size={24} />
            <span className="flex-1 text-[13.5px]">{m.login}</span>
            {m.role === "owner" ? (
              <Badge tone="ember">Owner</Badge>
            ) : (
              <>
                <span className="text-[12px] text-muted">{m.lastSeenAt ? `seen ${ago(m.lastSeenAt)}` : "never signed in"}</span>
                <RemoveButton label={`Remove ${m.login}`} onConfirm={() => remove.mutate(m.login)} />
              </>
            )}
          </div>
        ))}
        {q.data?.invites.map((i) => (
          <div key={i.login} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar src={githubAvatar(i.login)} alt={i.login} size={24} className="opacity-60" />
            <span className="flex-1 text-[13.5px] text-ink-2">{i.login}</span>
            <span className="text-[12px] text-muted">hasn't signed in yet</span>
            <RemoveButton label={`Remove ${i.login}`} onConfirm={() => remove.mutate(i.login)} />
          </div>
        ))}
      </Card>
    </Section>
  );
}

function RemoveButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <button onClick={onConfirm} aria-label={label} title={label} className="pressable grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger">
      <Trash2 className="size-3.5" />
    </button>
  );
}

/* ---------------- tokens ---------------- */

function Tokens() {
  const q = useTokens();
  const create = useCreateToken();
  const del = useDeleteToken();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(name.trim() || "CLI", {
      onSuccess: (r) => {
        setFresh(r.token);
        setName("");
      },
      onError: (err) => toast.error("Couldn't create a token", { description: err.message }),
    });
  };

  return (
    <Section title="CLI tokens" description="For the oche command. Each token acts as you.">
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. MacBook" className={inputClass} aria-label="Token name" maxLength={60} />
        <Button type="submit" loading={create.isPending}>
          Create token
        </Button>
      </form>
      <Card className="divide-y divide-line">
        {q.data?.tokens.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px]">{t.name}</p>
              <p className="font-mono text-[11.5px] text-muted">{t.prefix}…</p>
            </div>
            <span className="text-[12px] text-muted">{t.lastUsedAt ? `used ${ago(t.lastUsedAt)}` : "never used"}</span>
            <RemoveButton label={`Delete ${t.name}`} onConfirm={() => del.mutate(t.id)} />
          </div>
        ))}
        {q.data?.tokens.length === 0 && <p className="px-4 py-5 text-center text-[13px] text-muted">No tokens yet.</p>}
      </Card>
      <Dialog open={fresh !== null} onOpenChange={(o) => !o && setFresh(null)} title="Your new token" description="Copy it now. Oche only keeps a hash, so it can't show it again.">
        {fresh && <TokenReveal token={fresh} onDone={() => setFresh(null)} />}
      </Dialog>
    </Section>
  );
}

function TokenReveal({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <>
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 py-2 pr-2 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{token}</code>
        <Button size="sm" onClick={copy} aria-live="polite">
          {copied ? <Check className="size-3.5 text-prod" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-4 text-[12.5px] text-muted">Then, in a terminal:</p>
      <pre className="mt-1.5 overflow-x-auto rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-[12.5px]">oche login {API_URL}</pre>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
