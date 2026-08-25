import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getTeamMembers } from "@/lib/data";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const members = await getTeamMembers();
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Secretariat"
        title="Team"
        description="The rotating student secretariat that runs the conference."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {members.map((member) => (
          <Card key={member.id}>
            {member.photo_url ? (
              // CMS photo URLs are not in next/image remotePatterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photo_url}
                alt=""
                className="mb-4 h-28 w-28 object-cover"
              />
            ) : null}
            <p className="text-xs uppercase tracking-widest text-gold-700">{member.role_title}</p>
            <h2 className="mt-2 font-serif text-2xl">{member.full_name}</h2>
            {member.bio ? <p className="mt-3 text-sm text-ink-muted">{member.bio}</p> : null}
          </Card>
        ))}
      </div>
    </Container>
  );
}
