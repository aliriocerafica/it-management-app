"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OtpBoxes } from "@/components/otp-boxes"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  // Set once the password is accepted on a device that's new to the
  // account: the address the sign-in code was emailed to.
  const [codeSentTo, setCodeSentTo] = React.useState<string | null>(null)
  const [code, setCode] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)

  async function verifyCode(value: string) {
    if (loading || value.length !== 6) return
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const response = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Invalid or expired code.")
        setCode("")
        setLoading(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  async function resendCode() {
    if (loading) return
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const response = await fetch("/api/auth/login/resend", { method: "POST" })
      const body = await response.json().catch(() => null)
      if (response.ok) {
        setCode("")
        setNotice("We sent a new code.")
      } else {
        setError(body?.error ?? "We couldn't send a new code.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") ?? "")
    const password = String(data.get("password") ?? "")
    const rememberMe = Boolean(data.get("remember"))

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Invalid email or password.")
        setLoading(false)
        return
      }

      const body = await response.json().catch(() => null)
      if (body?.otpRequired) {
        setCode("")
        setCodeSentTo(email)
        setLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (codeSentTo) {
    return (
      <Card className="w-full ring-foreground/10 shadow-lg shadow-black/[0.03] dark:shadow-black/20">
        <CardHeader className="gap-1.5 px-6 pt-6 pb-2 text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            This is the first sign-in from this device. Enter the 6-digit code
            we sent to {codeSentTo}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pt-4">
          <form
            id="login-code-form"
            onSubmit={(event) => {
              event.preventDefault()
              void verifyCode(code)
            }}
            className="flex flex-col gap-4"
          >
            <OtpBoxes
              value={code}
              onChange={(value) => {
                setCode(value)
                setError(null)
                // The last digit sends it, without a trip to the button.
                if (value.length === 6) void verifyCode(value)
              }}
              disabled={loading}
              invalid={Boolean(error)}
              autoFocus
            />
            {error && (
              <p role="alert" className="text-center text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && !error && (
              <p className="text-center text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-3 border-t-0 bg-transparent px-6 pt-2 pb-6">
          <Button
            type="submit"
            form="login-code-form"
            className="h-9 w-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Checking…" : "Verify and sign in"}
          </Button>
          <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                setCodeSentTo(null)
                setCode("")
                setError(null)
                setNotice(null)
              }}
              disabled={loading}
              className="underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={loading}
              className="underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full ring-foreground/10 shadow-lg shadow-black/[0.03] dark:shadow-black/20">
        <CardHeader className="gap-1.5 px-6 pt-6 pb-2 text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to access IT Management</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pt-4">
          <form id="login-form" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="h-9 pl-8"
                    required
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-9 pr-9 pl-8"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                  </button>
                </div>
              </Field>
              <div className="flex items-center justify-between gap-4 pt-1">
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox id="remember" name="remember" />
                  <FieldLabel htmlFor="remember" className="font-normal">
                    Remember me
                  </FieldLabel>
                </Field>
                <a
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="border-t-0 bg-transparent px-6 pt-2 pb-6">
          <Button
            type="submit"
            form="login-form"
            className="h-9 w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
  )
}
