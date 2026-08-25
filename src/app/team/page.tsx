import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { HARDCODED_TEAM } from "@/lib/constants";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Secretariat"
        title="Team"
        description="The rotating student secretariat that runs the conference."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HARDCODED_TEAM.map((member) => (
          <Card key={member.id}>
            <p className="text-xs uppercase tracking-widest text-gold-700">{member.bio}</p>
            <h2 className="mt-2 font-serif text-2xl">{member.role_title}</h2>
            <p className="mt-3 text-sm text-ink-muted">{member.full_name}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
