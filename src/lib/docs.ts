export const DOC_KINDS = ["rulebook", "guidelines"] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABELS: Record<DocKind, string> = {
  rulebook: "Rulebook",
  guidelines: "Guidelines",
};

export function isDocKind(value: string): value is DocKind {
  return value === "rulebook" || value === "guidelines";
}

export type DocLinks = Record<DocKind, string | null>;

export function emptyDocLinks(): DocLinks {
  return { rulebook: null, guidelines: null };
}

export function isDocPublished(url: string | null | undefined): boolean {
  return Boolean(url && url.trim());
}

export function bothDocsPublished(links: DocLinks): boolean {
  return DOC_KINDS.every((kind) => isDocPublished(links[kind]));
}
