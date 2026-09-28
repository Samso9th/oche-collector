import clsx from "clsx";
import { useId } from "react";

/**
 * The Oche mark: a bold O in horizontal bands, after Idoma striped cloth.
 * Three ember bands for the three stages. The other bands take currentColor,
 * so the mark flips with the theme.
 */
const TOP = 1.5;
const H = 21;
const W = 19;
const X = (24 - W) / 2;
const R = 8.6;
const K = R / 2.2;
const OUTER = `M${X + R} ${TOP}H${X + W - R}C${X + W - K} ${TOP} ${X + W} ${TOP + K} ${X + W} ${TOP + R}V${TOP + H - R}C${X + W} ${TOP + H - K} ${X + W - K} ${TOP + H} ${X + W - R} ${TOP + H}H${X + R}C${X + K} ${TOP + H} ${X} ${TOP + H - K} ${X} ${TOP + H - R}V${TOP + R}C${X} ${TOP + K} ${X + K} ${TOP} ${X + R} ${TOP}Z`;
const CY = TOP + H / 2;
const COUNTER = `M12 ${CY - 5.9}A3.7 5.9 0 1 0 12 ${CY + 5.9}A3.7 5.9 0 1 0 12 ${CY - 5.9}Z`;
const BANDS = 7;
const BAND = H / BANDS;

export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={clsx("shrink-0", className)} aria-hidden>
      <defs>
        <clipPath id={id}>
          <path clipRule="evenodd" d={`${OUTER} ${COUNTER}`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {Array.from({ length: BANDS }, (_, i) => (
          <rect key={i} x="0" y={TOP + i * BAND} width="24" height={BAND + 0.02} fill={i % 2 ? "var(--ember)" : "currentColor"} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.03em]", className)}>
      <Mark size={20} />
      oche
    </span>
  );
}

/** GitHub's mark, for "Continue with GitHub" buttons. */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={clsx("size-4 shrink-0", className)} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
