import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Delegates" title="Sign in" />
      <Card className="max-w-md">
        <LoginForm nextPath={next && next.startsWith("/") ? next : "/dashboard"} />
      </Card>
    </Container>
  );
}
