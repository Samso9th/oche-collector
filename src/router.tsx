import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "./components/shell.tsx";
import { ApiError, api } from "./lib/api.ts";
import type { MeResponse, SetupStatusResponse } from "./lib/api-types.ts";
import { keys } from "./lib/queries.ts";
import { ActivityPage } from "./routes/activity.tsx";
import { LoginPage, SetupPage } from "./routes/auth.tsx";
import { ProjectsPage } from "./routes/projects.tsx";
import { RepoPage } from "./routes/repo.tsx";
import { SettingsPage } from "./routes/settings.tsx";

type Ctx = { queryClient: QueryClient };

const root = createRootRouteWithContext<Ctx>()({ component: Outlet });

const setupStatus = (qc: QueryClient) => qc.ensureQueryData({ queryKey: keys.setup, queryFn: () => api<SetupStatusResponse>("/setup/status") });

/** Everything inside needs a finished setup and a signed-in user. */
const app = createRoute({
  getParentRoute: () => root,
  id: "app",
  beforeLoad: async ({ context: { queryClient } }) => {
    const setup = await setupStatus(queryClient);
    if (!setup.configured) throw redirect({ to: "/setup" });
    try {
      await queryClient.ensureQueryData({ queryKey: keys.me, queryFn: () => api<MeResponse>("/v1/me") });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw redirect({ to: "/login" });
      throw e;
    }
  },
  component: AppShell,
});

const projects = createRoute({
  getParentRoute: () => app,
  path: "/",
  validateSearch: (s: Record<string, unknown>): { installed?: string } => (typeof s.installed === "string" ? { installed: s.installed } : {}),
  component: ProjectsPage,
});
const activity = createRoute({ getParentRoute: () => app, path: "/activity", component: ActivityPage });
const settings = createRoute({ getParentRoute: () => app, path: "/settings", component: SettingsPage });
const repo = createRoute({ getParentRoute: () => app, path: "/$owner/$repo", component: RepoPage });

const login = createRoute({
  getParentRoute: () => root,
  path: "/login",
  validateSearch: (s: Record<string, unknown>): { error?: string; login?: string } => ({
    ...(typeof s.error === "string" ? { error: s.error } : {}),
    ...(typeof s.login === "string" ? { login: s.login } : {}),
  }),
  component: LoginPage,
});
const setup = createRoute({ getParentRoute: () => root, path: "/setup", component: SetupPage });

const routeTree = root.addChildren([app.addChildren([projects, activity, settings, repo]), login, setup]);

export function makeRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPendingMs: 400,
    defaultErrorComponent: ({ error }) => (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-sm text-muted">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
