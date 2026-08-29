export type SponsorTier = "title" | "gold" | "silver" | "partner";

export type Sponsor = {
  name: string;
  tier: SponsorTier;
  logoUrl?: string;
  websiteUrl?: string;
};

/** Update this list as sponsor logos and links are confirmed. */
export const SPONSORS: Sponsor[] = [];

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  title: "Title sponsor",
  gold: "Gold sponsors",
  silver: "Silver sponsors",
  partner: "Partners",
};
