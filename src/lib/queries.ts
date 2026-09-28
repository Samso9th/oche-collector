import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.ts";
import type {
  ApiCoolifyInstance,
  CoolifySetupPlan,
  CoolifySetupRequest,
  CoolifySetupResult,
  DeploymentDetail,
  RepoDeploymentsResponse,
  CreateTokenResponse,
  EventsResponse,
  InstallationsResponse,
  MeResponse,
  MembersResponse,
  Mode,
  OnboardResponse,
  PromoteResponse,
  Promotion,
  RepoResponse,
  ReposResponse,
  SetupStatusResponse,
  ShipRequest,
  ShipResponse,
  TokensResponse,
  UpdateRepoResponse,
} from "./api-types.ts";

export const keys = {
  setup: ["setup"] as const,
  me: ["me"] as const,
  repos: ["repos"] as const,
  repo: (full: string) => ["repo", full] as const,
  events: (repo?: string) => ["events", repo ?? "all"] as const,
  installations: ["installations"] as const,
  members: ["members"] as const,
  tokens: ["tokens"] as const,
  coolify: ["coolify-instances"] as const,
  deployments: (full: string) => ["deployments", full] as const,
  deployment: (full: string, app: string, id: string) => ["deployment", full, app, id] as const,
};

export const useSetupStatus = () => useQuery({ queryKey: keys.setup, queryFn: () => api<SetupStatusResponse>("/setup/status"), staleTime: 60_000 });

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<MeResponse>("/v1/me"), staleTime: 5 * 60_000, retry: false });

export const useRepos = () => useQuery({ queryKey: keys.repos, queryFn: () => api<ReposResponse>("/v1/repos") });

export const useRepo = (full: string, opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: keys.repo(full),
    queryFn: () => api<RepoResponse>(`/v1/repos/${full}`),
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });

export const useEvents = (repo?: string) =>
  useQuery({
    queryKey: keys.events(repo),
    queryFn: () => api<EventsResponse>(`/v1/events?limit=100${repo ? `&repo=${encodeURIComponent(repo)}` : ""}`),
    refetchInterval: 30_000,
  });

export const useInstallations = () => useQuery({ queryKey: keys.installations, queryFn: () => api<InstallationsResponse>("/v1/installations") });
export const useMembers = (enabled: boolean) => useQuery({ queryKey: keys.members, queryFn: () => api<MembersResponse>("/v1/members"), enabled });
export const useTokens = () => useQuery({ queryKey: keys.tokens, queryFn: () => api<TokensResponse>("/v1/tokens") });

function useInvalidateRepo() {
  const qc = useQueryClient();
  return (full: string) => {
    void qc.invalidateQueries({ queryKey: keys.repo(full) });
    void qc.invalidateQueries({ queryKey: ["events"] });
    void qc.invalidateQueries({ queryKey: keys.repos });
  };
}

export function usePromote(full: string) {
  const invalidate = useInvalidateRepo();
  return useMutation({
    mutationFn: (to: Promotion) => api<PromoteResponse>(`/v1/repos/${full}/promote`, { method: "POST", body: { to } }),
    onSettled: () => invalidate(full),
  });
}

export function useShip(full: string) {
  const invalidate = useInvalidateRepo();
  return useMutation({
    mutationFn: (req: ShipRequest) => api<ShipResponse>(`/v1/repos/${full}/ship`, { method: "POST", body: req }),
    onSettled: () => invalidate(full),
  });
}

export function useOnboardPlan(full: string, enabled: boolean) {
  return useQuery({
    queryKey: ["onboard-plan", full],
    queryFn: () => api<OnboardResponse>(`/v1/repos/${full}/onboard`, { method: "POST", body: { dryRun: true } }),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useOnboard(full: string) {
  const invalidate = useInvalidateRepo();
  return useMutation({
    mutationFn: () => api<OnboardResponse>(`/v1/repos/${full}/onboard`, { method: "POST", body: { dryRun: false } }),
    onSuccess: () => invalidate(full),
  });
}

export function useUpdateRepo(full: string) {
  const invalidate = useInvalidateRepo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { mode?: Mode; requiredApprovals?: number }) =>
      api<UpdateRepoResponse>(`/v1/repos/${full}`, { method: "PATCH", body: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.repo(full) });
      const prev = qc.getQueryData<RepoResponse>(keys.repo(full));
      if (prev) qc.setQueryData<RepoResponse>(keys.repo(full), { ...prev, repo: { ...prev.repo, ...patch } });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(keys.repo(full), ctx.prev),
    onSettled: () => invalidate(full),
  });
}

export function useRefreshRepos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ReposResponse>("/v1/repos/refresh", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(keys.repos, data);
      void qc.invalidateQueries({ queryKey: keys.installations });
    },
  });
}

export function useInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (login: string) => api<{ ok: true }>("/v1/members", { method: "POST", body: { login } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.members }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (login: string) => api<{ ok: true }>(`/v1/members/${encodeURIComponent(login)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.members }),
  });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<CreateTokenResponse>("/v1/tokens", { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tokens }),
  });
}

export function useDeleteToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/v1/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tokens }),
  });
}

/* ---------------- Coolify ---------------- */

export const useCoolifyInstances = () =>
  useQuery({ queryKey: keys.coolify, queryFn: () => api<{ instances: ApiCoolifyInstance[] }>("/v1/coolify/instances") });

export function useAddCoolify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; url: string; token: string; cfAccessClientId?: string; cfAccessClientSecret?: string }) =>
      api<{ instance: ApiCoolifyInstance }>("/v1/coolify/instances", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.coolify }),
  });
}

export function useUpdateCoolify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; token?: string; cfAccessClientId?: string | null; cfAccessClientSecret?: string }) =>
      api<{ instance: ApiCoolifyInstance }>(`/v1/coolify/instances/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.coolify }),
  });
}

export function useCheckCoolify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ instance: ApiCoolifyInstance }>(`/v1/coolify/instances/${id}/check`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.coolify });
      void qc.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

export function useRemoveCoolify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/v1/coolify/instances/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.coolify });
      void qc.invalidateQueries({ queryKey: ["deployments"] });
    },
  });
}

export function useLinkCoolify(full: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) =>
      api<{ matched: { stage: string; uuid: string; name: string }[] }>(`/v1/repos/${full}/coolify`, { method: "PUT", body: { instanceId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.deployments(full) });
      void qc.invalidateQueries({ queryKey: keys.coolify });
    },
  });
}

export function useUnlinkCoolify(full: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>(`/v1/repos/${full}/coolify`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.deployments(full) });
      void qc.invalidateQueries({ queryKey: keys.coolify });
    },
  });
}

const ACTIVE = new Set(["queued", "in_progress"]);
export const isActive = (status: string) => ACTIVE.has(status);

/** Polls faster while something is building. */
export const useDeployments = (full: string) =>
  useQuery({
    queryKey: keys.deployments(full),
    queryFn: () => api<RepoDeploymentsResponse>(`/v1/repos/${full}/deployments`),
    refetchInterval: (q) => (q.state.data?.apps.some((a) => a.deployments[0] && isActive(a.deployments[0].status)) ? 4_000 : 20_000),
    placeholderData: keepPreviousData,
    retry: false,
  });

export const useDeploymentDetail = (full: string, app: string, id: string, live: boolean) =>
  useQuery({
    queryKey: keys.deployment(full, app, id),
    queryFn: () => api<DeploymentDetail>(`/v1/repos/${full}/deployments/${app}/${id}`),
    refetchInterval: live ? 3_000 : false,
  });

export function useExplain(full: string, app: string, id: string) {
  return useMutation({
    mutationFn: () => api<{ explanation: string }>(`/v1/repos/${full}/deployments/${app}/${id}/explain`, { method: "POST" }),
  });
}

export function useRedeploy(full: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ app, force }: { app: string; force: boolean }) =>
      api<{ deploymentUuid: string | null }>(`/v1/repos/${full}/apps/${app}/deploy`, { method: "POST", body: { force } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.deployments(full) });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export const useSetupPlan = (full: string, enabled: boolean) =>
  useQuery({
    queryKey: ["coolify-setup", full],
    queryFn: () => api<CoolifySetupPlan>(`/v1/repos/${full}/coolify/setup`),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

export function useRunSetup(full: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CoolifySetupRequest) => api<CoolifySetupResult>(`/v1/repos/${full}/coolify/setup`, { method: "POST", body: req }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.deployments(full) });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
