"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction, signupAction, forgotPasswordAction, type AuthState } from "@/app/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(loginAction, {} as AuthState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
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
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm text-ink" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Full name" htmlFor="full_name" error={state.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
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
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm text-ink" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
