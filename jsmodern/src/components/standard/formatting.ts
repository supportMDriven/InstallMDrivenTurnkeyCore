export function formatNumber(value: number, format: string): string {
  const decimalPattern = format.match(/\.([0#]+)/)?.[1];
  return new Intl.NumberFormat(undefined, {
    useGrouping: format.includes(","),
    minimumFractionDigits: decimalPattern?.replace(/#/g, "").length ?? 0,
    maximumFractionDigits: decimalPattern?.length ?? 20
  }).format(value);
}

export function parseNumber(value: string): number {
  const parts = new Intl.NumberFormat().formatToParts(1000.1);
  const groupSeparator = parts.find(part => part.type === "group")?.value;
  const decimalSeparator = parts.find(part => part.type === "decimal")?.value ?? ".";
  const normalized = value
    .trim()
    .replace(/[−]/g, "-")
    .replace(groupSeparator ? new RegExp(`[${groupSeparator}\\s\\u00a0\\u202f]`, "g") : /[\s\u00a0\u202f]/g, "")
    .replace(decimalSeparator, ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid numeric value: ${value}`);
  }
  return parsed;
}
