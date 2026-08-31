import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { MyTeamPanel } from "@/components/dashboard/my-team-panel";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getMyTeamContext } from "@/lib/groups";

export const metadata: Metadata = { title: "My team" };

export default async function MyTeamPage() {
  const context = await getMyTeamContext();
  if (!context) redirect("/dashboard");

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Participant" title="My team" description={context.groupName} />
      <DashboardNav current="/dashboard/team" showTeam />
      <Card>
        <MyTeamPanel context={context} />
      </Card>
    </Container>
  );
}
