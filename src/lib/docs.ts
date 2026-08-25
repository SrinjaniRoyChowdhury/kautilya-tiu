export const DOC_KINDS = ["rulebook", "guidelines"] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABELS: Record<DocKind, string> = {
  rulebook: "Rulebook",
  guidelines: "Guidelines",
};

export function isDocKind(value: string): value is DocKind {
  return value === "rulebook" || value === "guidelines";
}

export const MAX_DOC_BYTES = 12 * 1024 * 1024;
