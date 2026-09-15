import type { Metadata } from "next";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Card, PageHeader } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getProfile();
  return (
    <>
      <PageHeader eyebrow="Participant" title="Profile" />
      <Card>
        {profile ? (
          <ProfileForm profile={profile} />
        ) : (
          <p className="text-ink-muted">Could not load your profile.</p>
        )}
      </Card>
    </>
  );
}
