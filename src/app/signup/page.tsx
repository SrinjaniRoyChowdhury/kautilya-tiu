import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Delegates"
        title="Sign up"
        description="Verify your email before submitting a registration or payment."
      />
      <Card className="max-w-md">
        <SignupForm />
      </Card>
    </Container>
  );
}
