import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Stage } from "../lib/api-types.ts";

/* ---------------- Button ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-ember text-ember-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.06]",
  secondary: "bg-surface text-ink shadow-card hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-surface text-danger shadow-card hover:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "pressable inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size }) {
  return (
    <a
      {...rest}
      className={clsx("pressable inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap", variants[variant], sizes[size], className)}
    />
  );
}

/* ---------------- Stage marks ---------------- */

export const STAGE_LABEL: Record<Stage, string> = { dev: "Dev", staging: "Staging", prod: "Production" };
export const STAGE_TEXT: Record<Stage, string> = { dev: "text-dev", staging: "text-staging", prod: "text-prod" };
export const STAGE_BG: Record<Stage, string> = { dev: "bg-dev", staging: "bg-staging", prod: "bg-prod" };

export function StageDot({ stage, live = false, className }: { stage: Stage; live?: boolean; className?: string }) {
  return (
    <span className={clsx("relative inline-block size-2 shrink-0 rounded-full", STAGE_BG[stage], STAGE_TEXT[stage], live && "pulse", className)} aria-hidden />
  );
}

export function BranchName({ name, stage, className }: { name: string; stage?: Stage; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-mono text-[12.5px] text-ink-2", className)}>
      {stage && <StageDot stage={stage} />}
      {name}
    </span>
  );
}

/* ---------------- Small pieces ---------------- */

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "ember" | "warn" | "danger" | "ok"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    ember: "bg-ember-soft text-ember",
    warn: "bg-staging/12 text-staging",
    danger: "bg-danger/10 text-danger",
    ok: "bg-prod/12 text-prod",
  };
  return <span className={clsx("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function Avatar({ src, alt, size = 20, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={`${src}${src.includes("?") ? "&" : "?"}s=${size * 2}`}
      alt=""
      title={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={clsx("shrink-0 rounded-full bg-surface-2", className)}
      loading="lazy"
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={clsx("inline-grid shrink-0 place-items-center rounded-full bg-surface-2 font-medium text-muted uppercase", className)}
      aria-label={alt}
    >
      {alt.slice(0, 1)}
    </span>
  );
}

export const githubAvatar = (login: string | null | undefined) => (login ? `https://github.com/${login.replace(/\[bot\]$/, "")}.png` : null);

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line-strong px-1 font-sans text-[11px] text-muted">{children}</kbd>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-xl bg-surface shadow-card", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------- Dialog ---------------- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="backdrop fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] dark:bg-black/50" />
        <BaseDialog.Popup
          className={clsx(
            "dialog z-50 w-[calc(100vw-24px)] max-w-md rounded-2xl bg-surface p-5 shadow-pop outline-none sm:p-6",
            className,
          )}
        >
          <BaseDialog.Title className="text-[15px] font-semibold tracking-[-0.01em]">{title}</BaseDialog.Title>
          {description && <BaseDialog.Description className="mt-1 text-sm text-muted">{description}</BaseDialog.Description>}
          <div className="mt-4">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
