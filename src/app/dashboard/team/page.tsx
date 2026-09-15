import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyTeamPanel } from "@/components/dashboard/my-team-panel";
import { Card, PageHeader } from "@/components/ui/card";
import { getMyTeamContext } from "@/lib/groups";

export const metadata: Metadata = { title: "My team" };

export default async function MyTeamPage() {
  const context = await getMyTeamContext();
  if (!context) redirect("/dashboard");

  return (
    <>
      <PageHeader eyebrow="Participant" title="My team" description={context.groupName} />
      <Card>
        <MyTeamPanel context={context} />
      </Card>
    </>
  );
}
