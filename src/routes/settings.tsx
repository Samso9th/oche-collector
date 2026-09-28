import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, Card, Dialog, githubAvatar, LinkButton, Skeleton } from "../components/ui.tsx";
import { API_URL } from "../lib/api.ts";
import { ago } from "../lib/time.ts";
import {
  useCreateToken,
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
  "h-9 min-w-0 flex-1 rounded-lg bg-surface px-3 text-[13.5px] shadow-card outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ember";

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
    <Section title="People" description="Who can sign in. Members can promote repos they have write access to on GitHub; only you can set repos up or change modes.">
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
