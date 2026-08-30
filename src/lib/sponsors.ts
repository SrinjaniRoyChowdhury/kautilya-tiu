import type { CmsSponsor, SponsorCategory } from "@/types";

export type SponsorTier = SponsorCategory;

export type Sponsor = {
  id: string;
  name: string;
  tier: SponsorTier;
  logoUrl?: string;
};

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  title: "Title sponsor",
  gold: "Gold sponsors",
  silver: "Silver sponsors",
  partner: "Partners",
};

export const SPONSOR_CATEGORY_OPTIONS: { value: SponsorTier; label: string }[] = [
  { value: "title", label: SPONSOR_TIER_LABELS.title },
  { value: "gold", label: SPONSOR_TIER_LABELS.gold },
  { value: "silver", label: SPONSOR_TIER_LABELS.silver },
  { value: "partner", label: SPONSOR_TIER_LABELS.partner },
];

export function mapCmsSponsor(row: CmsSponsor): Sponsor {
  return {
    id: row.id,
    name: row.name,
    tier: row.category,
    logoUrl: row.logo_url ?? undefined,
  };
}
