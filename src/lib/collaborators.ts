import type { CmsCollaborator, CollaboratorCategory } from "@/types";

export type Collaborator = {
  id: string;
  name: string;
  category: CollaboratorCategory;
  logoUrl?: string;
};

export const COLLABORATOR_CATEGORY_LABELS: Record<CollaboratorCategory, string> = {
  society: "Student societies",
  institution: "Institutions",
  media: "Media partners",
  partner: "Partners",
};

export const COLLABORATOR_CATEGORY_OPTIONS: { value: CollaboratorCategory; label: string }[] = [
  { value: "society", label: COLLABORATOR_CATEGORY_LABELS.society },
  { value: "institution", label: COLLABORATOR_CATEGORY_LABELS.institution },
  { value: "media", label: COLLABORATOR_CATEGORY_LABELS.media },
  { value: "partner", label: COLLABORATOR_CATEGORY_LABELS.partner },
];

export function mapCmsCollaborator(row: CmsCollaborator): Collaborator {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    logoUrl: row.logo_url ?? undefined,
  };
}
