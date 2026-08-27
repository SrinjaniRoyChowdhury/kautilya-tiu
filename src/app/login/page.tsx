import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { safeInternalPath } from "@/lib/safe-path";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Container className="py-12">
        <PageHeader
          eyebrow="Account"
          title="Sign in"
          description="Delegates sign in with email. Staff accounts created under Admin → Accounts sign in with username and password."
        />
      <Card className="max-w-md">
        <LoginForm nextPath={safeInternalPath(next, "/dashboard")} />
      </Card>
    </Container>
  );
}
