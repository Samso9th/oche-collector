import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ApiRepo, EnvComparison, Stage } from "../lib/api-types.ts";
import { useEnvs } from "../lib/queries.ts";
import { Badge, Card, Skeleton, STAGE_LABEL, StageDot } from "./ui.tsx";

const STAGES: Stage[] = ["dev", "staging", "prod"];
const ISSUE = {
  "missing-in-prod": { label: "Missing in production", tone: "danger" },
  "missing-in-staging": { label: "Missing in staging", tone: "warn" },
  "same-secret": { label: "Same value as staging", tone: "warn" },
} as const;

/** Keys across dev, staging and production for each app. Values stay on the server. */
export function EnvCompare({ repo }: { repo: ApiRepo }) {
  const [open, setOpen] = useState(false);
  const q = useEnvs(repo.fullName, repo.coolifyLinked);
  if (!repo.coolifyLinked) return null;

  const totals = (q.data?.groups ?? []).reduce(
    (t, g) => ({ prod: t.prod + g.counts.missingInProd, staging: t.staging + g.counts.missingInStaging, same: t.same + g.counts.sameSecret }),
    { prod: 0, staging: 0, same: 0 },
  );
  const issues = totals.prod + totals.staging + totals.same;

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <h2 className="text-[13px] font-medium">Environment variables</h2>
        {q.isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : q.isError ? (
          <span className="text-[12.5px] text-danger">{q.error.message}</span>
        ) : issues === 0 ? (
          <Badge tone="ok">In step across environments</Badge>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {totals.prod > 0 && <Badge tone="danger">{totals.prod} missing in production</Badge>}
            {totals.staging > 0 && <Badge tone="warn">{totals.staging} missing in staging</Badge>}
            {totals.same > 0 && <Badge tone="warn">{totals.same} shared with staging</Badge>}
          </span>
        )}
        <ChevronDown className={clsx("ml-auto size-4 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && q.data && (
        <div className="border-t border-line">
          {q.data.groups.map((g) => (
            <Group key={g.label} group={g} />
          ))}
          <p className="px-4 py-3 text-[12px] text-muted">
            Oche compares names and whether values match; it never shows values. Coolify's own variables and preview-only ones are left out. Shared
            variables set on a Coolify environment show as present when an app references them.
          </p>
        </div>
      )}
    </Card>
  );
}

function Group({ group }: { group: EnvComparison }) {
  const [all, setAll] = useState(false);
  const rows = all ? group.rows : group.rows.filter((r) => r.issue);
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <h3 className="text-[12.5px] font-medium">{group.label}</h3>
        <span className="text-[12px] text-muted">
          {STAGES.filter((s) => group.apps[s])
            .map((s) => group.apps[s]!.name)
            .join(" · ")}
        </span>
        <button onClick={() => setAll((a) => !a)} className="ml-auto text-[12px] font-medium text-ink-2 hover:text-ink">
          {all ? "Only differences" : `All ${group.rows.length}`}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-3 text-[12.5px] text-muted">No differences.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="px-4 py-1.5 font-medium">Key</th>
                {STAGES.map((s) => (
                  <th key={s} className="px-2 py-1.5 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <StageDot stage={s} /> {STAGE_LABEL[s]}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="px-4 py-1.5 font-mono">{r.key}</td>
                  {STAGES.map((s) => (
                    <td key={s} className="px-2 py-1.5">
                      {r.present[s] === undefined ? (
                        <span className="text-muted">·</span>
                      ) : r.present[s] ? (
                        <span className="text-prod">✓</span>
                      ) : (
                        <span className="text-danger">✗</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-1.5 text-right">{r.issue && <Badge tone={ISSUE[r.issue].tone}>{ISSUE[r.issue].label}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
