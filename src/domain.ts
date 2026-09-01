export type RuleKind = "allow" | "block";

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function isValidDomain(value: string, allowWildcard = false): boolean {
  const normalized = normalizeDomain(value);
  const domain = normalized.startsWith("*.") ? normalized.slice(2) : normalized;
  if (normalized.startsWith("*.") && !allowWildcard) return false;
  if (!domain || domain.length > 253 || domain.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
}

export function assertDomain(value: string, kind?: RuleKind): string {
  const normalized = normalizeDomain(value);
  if (!isValidDomain(normalized, kind === "allow")) {
    throw new Error(`Invalid domain: ${value}`);
  }
  if (kind === "block" && normalized.startsWith("*.")) {
    throw new Error("Block rules must use the base domain; subdomains are included automatically");
  }
  return normalized;
}
