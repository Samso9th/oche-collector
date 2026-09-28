const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Math.abs(secs) < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size || unit === "minute") return rtf.format(Math.round(secs / size), unit);
  }
  return "";
}

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
