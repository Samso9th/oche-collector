/**
 * Mirror of server/src/core/api.ts. Keep in sync.
 *
 * The HTTP contract between the Oche server and its clients. All routes live
 * under /v1 and take `Authorization: Bearer <token>`. Errors come back as
 * { error: string } with a 4xx/5xx status. Type declarations only: nothing
 * here exists at runtime.
 */

/* ---- from flow.ts ------------------------------------------------- */

export type Mode = "fast" | "strict";

export interface Branches {
  prod: string;
  staging: string;
  dev: string;
}

export type Stage = "prod" | "staging" | "dev";

export type MoveKind =
  | "feature" // any work branch → dev
  | "promote-staging" // dev → staging
  | "promote-prod" // staging → prod
  | "skip-staging" // dev → prod
  | "sync-staging" // prod (or an oche/sync/* branch) → staging, opened by Oche
  | "unmanaged"; // base isn't one of the three branches

export interface ApprovalStatus {
  approvals: number;
  required: number;
  changesRequested: boolean;
  satisfied: boolean;
}

/** The promotions a person can ask for from the dashboard or CLI. */
export type Promotion = "staging" | "prod" | "prod-direct";

/* ---- from github.ts ----------------------------------------------- */

export type EventType =
  | "onboarded"
  | "branch-created"
  | "promoted"
  | "promotion-waiting"
  | "promotion-conflict"
  | "synced"
  | "sync-conflict"
  | "pr-blocked"
  | "pr-retargeted"
  | "branch-restored"
  | "direct-push"
  | "mode-changed";

export interface OcheEvent {
  type: EventType;
  summary: string;
  prNumber?: number;
  data?: Record<string, unknown>;
}

export interface OnboardingPlan {
  branches: Branches;
  prodSha: string;
  defaultBranch: string;
  steps: { id: string; label: string; done: boolean }[];
}

export interface BranchHead {
  name: string;
  sha: string;
  message: string;
  author: string | null;
  avatarUrl: string | null;
  date: string | null;
}

export interface OpenPromotion {
  number: number;
  title: string;
  head: string;
  base: string;
  url: string;
  kind: MoveKind;
}

export interface OpenWork {
  number: number;
  title: string;
  head: string;
  url: string;
  author: string | null;
  draft: boolean;
}

export interface RepoStatus {
  heads: Partial<Record<Stage, BranchHead>>;
  /** Open PRs from work branches into dev: the ones a ship can start from. */
  openWork: OpenWork[];
  /** Commits waiting to move up a stage. */
  pending: { staging: number; prod: number; prodDirect: number };
  openPromotions: OpenPromotion[];
  blockedPullRequests: number;
}

export interface PrSummary {
  number: number;
  url: string;
  title: string;
  head: string;
  base: string;
}

export type PromoteResult =
  | { status: "merged"; pr: PrSummary; events: OcheEvent[] }
  | { status: "waiting-review"; pr: PrSummary; approval: ApprovalStatus; events: OcheEvent[] }
  | { status: "nothing-to-promote"; events: OcheEvent[] }
  | { status: "conflict"; pr: PrSummary; events: OcheEvent[] }
  | { status: "blocked"; reason: string; events: OcheEvent[] };

/* ---- api.ts ------------------------------------------------------- */

export interface ApiUser {
  login: string;
  avatarUrl: string | null;
  role: "owner" | "member";
}

export interface ApiRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  /** True once onboarded; Oche only guards and promotes managed repos. */
  managed: boolean;
  mode: Mode;
  requiredApprovals: number;
  branches: Branches | null;
  htmlUrl: string;
}

export interface ApiEvent {
  id: number;
  repo: string;
  type: EventType;
  summary: string;
  actor: string | null;
  prNumber: number | null;
  createdAt: string;
}

/** GET /v1/me */
export type MeResponse = ApiUser;

/** GET /v1/repos */
export type ReposResponse = { repos: ApiRepo[] };

/** GET /v1/repos/:owner/:repo */
export type RepoResponse = { repo: ApiRepo; status: RepoStatus | null; events: ApiEvent[] };

/** POST /v1/repos/:owner/:repo/onboard  body: { dryRun?: boolean } */
export type OnboardRequest = { dryRun?: boolean };
export type OnboardResponse = { plan: OnboardingPlan; applied: boolean; repo: ApiRepo };

/** POST /v1/repos/:owner/:repo/promote  body: { to } */
export type PromoteRequest = { to: Promotion };
/**
 * PromoteResult minus `events`, per variant. A plain Omit<Union, K> collapses
 * the union to its shared keys ({ status }) and loses pr/approval/reason.
 */
export type PromoteResponse = PromoteResult extends infer R ? (R extends unknown ? Omit<R, "events"> : never) : never;

/** PATCH /v1/repos/:owner/:repo  body: { mode?, requiredApprovals? } */
export type UpdateRepoRequest = { mode?: Mode; requiredApprovals?: number };
export type UpdateRepoResponse = { repo: ApiRepo };

/** GET /v1/events?repo=owner/name&limit=50 */
export type EventsResponse = { events: ApiEvent[] };

/* ---- ship ---- */

export type ShipTarget = "dev" | "staging" | "prod";

/** POST /v1/repos/:owner/:repo/ship. Merges `from` into dev if it's a work branch, then promotes up to `to`. */
export interface ShipRequest {
  from?: string;
  to: ShipTarget;
  /** Skip staging: dev → main, then Oche syncs staging. */
  direct?: boolean;
}

export type ShipStep = { label: string; head: string; base: string } & PromoteResponse;

export type ShipResponse = { steps: ShipStep[]; completed: boolean };

export type ApiError = { error: string };
/** GET /setup/status (no auth) */
export type SetupStatusResponse = {
  configured: boolean;
  owner: string;
  app: { slug: string; htmlUrl: string; installUrl: string } | null;
  webhookUrl: string;
};

/** GET /v1/installations */
export type InstallationsResponse = {
  installUrl: string | null;
  installations: {
    id: number;
    account: string;
    type: string;
    avatarUrl: string | null;
    suspended: boolean;
    repos: number;
    managed: number;
    settingsUrl: string;
  }[];
};

/** GET /v1/members (owner). POST /v1/members { login }. DELETE /v1/members/:login */
export type MembersResponse = {
  members: (ApiUser & { lastSeenAt: string | null })[];
  invites: { login: string; addedBy: string; createdAt: string }[];
};

/** GET /v1/tokens. POST /v1/tokens { name } → { token } shown once. DELETE /v1/tokens/:id */
export type TokensResponse = {
  tokens: { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[];
};
export type CreateTokenResponse = { token: string };
