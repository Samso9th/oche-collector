import { Menu } from "@base-ui/react/menu";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { Command } from "cmdk";
import { Activity, FolderGit2, LogOut, Plus, RefreshCw, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { api, loginUrl } from "../lib/api.ts";
import { useInstallations, useMe, useRefreshRepos, useRepos } from "../lib/queries.ts";
import { Wordmark } from "./logo.tsx";
import { Avatar, Kbd, StageDot } from "./ui.tsx";

const NAV = [
  { to: "/", label: "Projects", icon: FolderGit2 },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:px-6">
          <Link to="/" className="mr-3 rounded-md" aria-label="Oche home">
            <Wordmark height={21} />
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="pressable inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted hover:text-ink data-[status=active]:bg-surface-2 data-[status=active]:text-ink"
              >
                <Icon className="size-4 sm:hidden" aria-hidden />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="pressable hidden h-8 items-center gap-2 rounded-lg bg-surface pr-1.5 pl-2.5 text-[13px] text-muted shadow-card hover:text-ink sm:inline-flex"
            >
              <Search className="size-3.5" aria-hidden />
              Jump to…
              <Kbd>⌘K</Kbd>
            </button>
            <button onClick={() => setPaletteOpen(true)} className="pressable grid size-8 place-items-center rounded-md text-muted sm:hidden" aria-label="Search">
              <Search className="size-4" />
            </button>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <SignInAgain />
        <Outlet />
      </main>
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

/** A member's GitHub token expired or was revoked, so Oche can't tell which projects they can see. */
function SignInAgain() {
  const me = useMe();
  if (!me.data?.needsSignIn) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-staging/12 px-4 py-3 text-[13px]">
      <p className="min-w-0 flex-1">
        <span className="font-medium">Sign in again to see your projects.</span>{" "}
        <span className="text-ink-2">Oche checks with GitHub which repos you can reach, and your GitHub sign-in has expired.</span>
      </p>
      <a href={loginUrl} className="font-medium text-ink hover:underline">
        Sign in with GitHub
      </a>
    </div>
  );
}

function UserMenu() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (!me.data) return null;
  const signOut = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    qc.clear();
    void navigate({ to: "/login" });
  };
  return (
    <Menu.Root>
      <Menu.Trigger className="pressable rounded-full" aria-label="Account">
        <Avatar src={me.data.avatarUrl} alt={me.data.login} size={28} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="popup min-w-52 rounded-xl bg-surface p-1 shadow-pop outline-none">
            <div className="px-2.5 pt-1.5 pb-2">
              <p className="text-[13px] font-medium">{me.data.login}</p>
              <p className="text-[12px] text-muted capitalize">{me.data.role}</p>
            </div>
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <Menu.Item
              onClick={signOut}
              className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-highlighted:bg-surface-2"
            >
              <LogOut className="size-3.5 text-muted" /> Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** ⌘K. Opened from the keyboard many times a day, so it appears instantly: no animation. */
function Palette({ onClose }: { onClose: () => void }) {
  const repos = useRepos();
  const installs = useInstallations();
  const refresh = useRefreshRepos();
  const navigate = useNavigate();

  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item =
    "flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-2 select-none data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-3 pt-[12vh] dark:bg-black/50" onMouseDown={onClose}>
      <Command
        label="Jump to"
        loop
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-muted" aria-hidden />
          <Command.Input autoFocus placeholder="Find a repo or an action…" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none" />
        </div>
        <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">No matches.</Command.Empty>
          <Command.Group heading="Repos" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-muted">
            {repos.data?.repos.map((r) => (
              <Command.Item
                key={r.id}
                value={`${r.fullName} ${r.managed ? "guarded" : "not set up"}`}
                onSelect={() => go(() => navigate({ to: "/$owner/$repo", params: { owner: r.owner, repo: r.name } }))}
                className={item}
              >
                <StageDot stage={r.managed ? "prod" : "dev"} className={clsx(!r.managed && "opacity-30")} />
                <span className="truncate">
                  <span className="text-muted">{r.owner}/</span>
                  {r.name}
                </span>
                {!r.managed && <span className="ml-auto text-[12px] text-muted">Not set up</span>}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-muted">
            <Command.Item onSelect={() => go(() => refresh.mutate())} className={item}>
              <RefreshCw className="size-4 text-muted" /> Refresh repos from GitHub
            </Command.Item>
            {installs.data?.installUrl && (
              <Command.Item onSelect={() => go(() => window.open(installs.data!.installUrl!, "_blank"))} className={item}>
                <Plus className="size-4 text-muted" /> Add a GitHub account or org
              </Command.Item>
            )}
            <Command.Item onSelect={() => go(() => navigate({ to: "/activity" }))} className={item}>
              <Activity className="size-4 text-muted" /> Activity
            </Command.Item>
            <Command.Item onSelect={() => go(() => navigate({ to: "/settings" }))} className={item}>
              <Settings className="size-4 text-muted" /> Settings
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
