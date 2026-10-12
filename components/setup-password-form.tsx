"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { PasswordRules } from "@/components/password-rules"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isStrongPassword } from "@/lib/password"

function PasswordInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        className="pr-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        required
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
    </div>
  )
}

export function SetupPasswordForm({
  token,
  name,
  email,
}: {
  token: string
  name: string
  email: string
}) {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword
  const canSubmit = isStrongPassword(password) && password === confirmPassword && !loading

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const response = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Could not set your password. Please try again.")
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push("/login"), 1500)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>You&apos;re all set</CardTitle>
          <CardDescription>
            Sign in with {email} and your new password. Redirecting you to sign in…
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Set up your account</CardTitle>
        <CardDescription>
          Welcome, {name.split(" ")[0]}. Choose a password for {email}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="setup-password-form" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput id="password" value={password} onChange={setPassword} />
            </Field>
            <PasswordRules password={password} />
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                invalid={!passwordsMatch}
              />
            </Field>
            {!passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent">
        <Button
          type="submit"
          form="setup-password-form"
          className="w-full"
          disabled={!canSubmit}
        >
          {loading ? "Saving…" : "Set password"}
        </Button>
      </CardFooter>
    </Card>
  )
}
