import type { Metadata } from "next";
import { DashboardNav, dashboardNavProps } from "@/components/dashboard/dashboard-nav";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const [profile, { showTeam }] = await Promise.all([getProfile(), dashboardNavProps()]);
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Participant" title="Profile" />
      <DashboardNav current="/dashboard/profile" showTeam={showTeam} />
      <Card>
        {profile ? (
          <ProfileForm profile={profile} />
        ) : (
          <p className="text-ink-muted">Could not load your profile.</p>
        )}
      </Card>
    </Container>
  );
}
