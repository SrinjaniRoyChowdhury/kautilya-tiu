"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { loginAction, signupAction, forgotPasswordAction, type AuthState } from "@/app/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(loginAction, {} as AuthState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <ActionFeedback error={state.error} />
      <p className="text-sm text-ink-muted">
        <Link href="/forgot-password" className="text-gold-700 hover:underline">
          Forgot password
        </Link>
        {" · "}
        <Link href="/signup" className="text-gold-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, {} as AuthState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Full name" htmlFor="full_name" error={state.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone} hint="Required. Digits only, 8–15 numbers.">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with upper, lower, and a number."
        error={state.fieldErrors?.password}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
      <p className="text-sm text-ink-muted">
        Already registered?{" "}
        <Link href="/login" className="text-gold-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {} as AuthState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
