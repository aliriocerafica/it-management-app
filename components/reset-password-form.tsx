"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react"

import { OtpBoxes } from "@/components/otp-boxes"
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

type Step = "otp" | "verifying" | "password" | "success"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = React.useState<Step>("otp")
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "")
  const [code, setCode] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [resending, setResending] = React.useState(false)
  const [resent, setResent] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const digits = code.replace(/\D/g, "")

  async function verifyCode() {
    if (!email.trim() || digits.length !== 6 || step === "verifying") return

    setError(null)
    setResent(false)
    setStep("verifying")
    const started = Date.now()

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: digits }),
      })
      const wait = Math.max(0, 700 - (Date.now() - started))
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Invalid or expired code.")
        setCode("")
        setStep("otp")
        return
      }

      setStep("password")
    } catch {
      setError("Something went wrong. Please try again.")
      setStep("otp")
    }
  }

  async function requestAgain() {
    if (!email.trim() || resending) return
    setError(null)
    setResent(false)
    setResending(true)
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Could not send a new code. Please try again.")
        return
      }
      setCode("")
      setResent(true)
    } catch {
      setError("Could not send a new code. Please try again.")
    } finally {
      setResending(false)
    }
  }

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isStrongPassword(newPassword)) {
      setError("Password does not meet the required checks.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: digits,
          newPassword,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? "Invalid or expired code.")
        setLoading(false)
        return
      }

      setStep("success")
      setTimeout(() => router.push("/login"), 1500)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (step === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Password updated</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Redirecting you to sign in…
          </p>
        </CardContent>
      </Card>
    )
  }

  if (step === "verifying") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verify</CardTitle>
          <CardDescription>Checking your code</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying OTP…</p>
        </CardContent>
      </Card>
    )
  }

  if (step === "password") {
    const passwordsMatch =
      confirmPassword.length === 0 || newPassword === confirmPassword
    const canSubmit =
      isStrongPassword(newPassword) &&
      newPassword === confirmPassword &&
      !loading

    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create a new password</CardTitle>
          <CardDescription>
            Code verified for {email.trim() || "your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="reset-password-form" onSubmit={handleReset}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-9"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    aria-pressed={showNewPassword}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOffIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                  </button>
                </div>
              </Field>
              <PasswordRules password={newPassword} />
              <Field>
                <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-9"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    aria-invalid={!passwordsMatch}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    aria-pressed={showConfirmPassword}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                  </button>
                </div>
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
            form="reset-password-form"
            className="w-full"
            disabled={!canSubmit}
          >
            {loading ? "Saving…" : "Reset password"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-1.5 px-6 pt-8 text-center">
        <CardTitle className="text-2xl">Verify</CardTitle>
        <CardDescription>
          Your code was sent to you via email
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 px-6 pb-8">
        {!searchParams.get("email") && (
          <Field className="w-full">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
        )}
        <OtpBoxes
          value={code}
          onChange={setCode}
          invalid={Boolean(error)}
          autoFocus={Boolean(email)}
        />
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
        {resent && !error && (
          <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">
            A new code was sent.
          </p>
        )}
        <Button
          size="lg"
          className="min-w-28"
          disabled={!email.trim() || digits.length !== 6}
          onClick={() => void verifyCode()}
        >
          Verify
        </Button>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive code?{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
            disabled={!email.trim() || resending}
            onClick={() => void requestAgain()}
          >
            {resending ? "Sending…" : "Request again"}
          </button>
        </p>
      </CardContent>
    </Card>
  )
}
