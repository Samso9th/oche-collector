import { useSearch } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { GithubIcon, Wordmark } from "../components/logo.tsx";
import { Card, LinkButton, Skeleton } from "../components/ui.tsx";
import { loginUrl, setupUrl } from "../lib/api.ts";
import { useSetupStatus } from "../lib/queries.ts";

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Wordmark height={34} />
        </div>
        {children}
      </div>
    </div>
  );
}

const ERRORS: Record<string, (login?: string) => string> = {
  "not-invited": (login) => `${login ?? "That account"} doesn't have access to this Oche. Ask the owner to add you under Settings → People.`,
  expired: () => "That sign-in link expired. Try again.",
  github: () => "GitHub didn't finish the sign-in. Try again.",
};

export function LoginPage() {
  const search = useSearch({ strict: false }) as { error?: string; login?: string };
  const error = search.error ? (ERRORS[search.error]?.(search.login) ?? "Sign-in failed.") : null;
  return (
    <Centered>
      <Card className="p-6 text-center">
        <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Sign in to Oche</h1>
        <p className="mt-1 text-[13px] text-muted">Use the GitHub account that owns or was added to this Oche.</p>
        {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-left text-[13px] text-danger">{error}</p>}
        <LinkButton href={loginUrl} variant="primary" className="mt-5 w-full">
          <GithubIcon /> Continue with GitHub
        </LinkButton>
      </Card>
    </Centered>
  );
}

/** First run. Three steps, most of them a single click on GitHub. */
export function SetupPage() {
  const status = useSetupStatus();
  const [name, setName] = useState("");
  const configured = status.data?.configured;

  return (
    <Centered>
      <Card className="p-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Connect Oche to GitHub</h1>
        <p className="mt-1 text-[13px] text-muted">
          Oche creates its own GitHub App with only the permissions it needs. You don't copy any keys.
        </p>

        {status.isLoading ? (
          <Skeleton className="mt-6 h-40" />
        ) : (
          <ol className="mt-6 space-y-5">
            <Step n={1} done={configured} title="Create the Oche app">
              {!configured && (
                <>
                  <p className="text-[12.5px] text-muted">
                    Signed in to GitHub as <span className="font-medium text-ink-2">{status.data?.owner}</span>. App names are unique on GitHub, so pick
                    your own.
                  </p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Oche ${status.data?.owner ?? ""}`}
                    maxLength={34}
                    className="mt-2.5 h-9 w-full field rounded-lg bg-surface px-3 text-[13.5px] outline-none placeholder:text-muted"
                    aria-label="App name"
                  />
                  <LinkButton href={setupUrl(name.trim() || undefined)} variant="primary" className="mt-2.5 w-full">
                    <GithubIcon /> Create app on GitHub
                  </LinkButton>
                </>
              )}
            </Step>
            <Step n={2} done={false} title="Install it on your account and orgs">
              {configured && status.data?.app && (
                <>
                  <p className="text-[12.5px] text-muted">Pick all repositories or just the ones Oche should guard. Repeat for each org.</p>
                  <LinkButton href={status.data.app.installUrl} className="mt-2.5 w-full">
                    Install {status.data.app.slug}
                  </LinkButton>
                </>
              )}
            </Step>
            <Step n={3} done={false} title="Sign in">
              {configured && (
                <LinkButton href={loginUrl} variant="ghost" className="w-full">
                  Continue with GitHub
                </LinkButton>
              )}
            </Step>
          </ol>
        )}
      </Card>
      {status.isError && (
        <p className="mt-4 text-center text-[13px] text-danger">{status.error.message}</p>
      )}
    </Centered>
  );
}

function Step({ n, done, title, children }: { n: number; done?: boolean; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? "grid size-6 shrink-0 place-items-center rounded-full bg-prod/15 text-prod"
            : "grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-medium text-muted"
        }
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={done ? "text-[13.5px] font-medium text-muted" : "text-[13.5px] font-medium"}>{title}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </li>
  );
}

