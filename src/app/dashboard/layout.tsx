import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Container } from "@/components/ui/card";
import { getProfile, getSessionUser } from "@/lib/auth";
import { getActiveEdition, getMyRegistration } from "@/lib/data";
import { getMyTeamContext } from "@/lib/groups";

/**
 * Shared participant shell: warm common caches once and keep the nav mounted
 * across Overview / Registration / Payment / Credential / Profile hops.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [, , edition, team] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getActiveEdition(),
    getMyTeamContext(),
  ]);

  if (edition) {
    await getMyRegistration(edition.id);
  }

  return (
    <Container className="py-12">
      <DashboardNav showTeam={Boolean(team)} />
      {children}
    </Container>
  );
}
