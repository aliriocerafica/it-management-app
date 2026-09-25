"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const router = useRouter()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push("/dashboard")
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="remember" name="remember" />
                <FieldLabel htmlFor="remember" className="font-normal">
                  Remember me
                </FieldLabel>
              </Field>
              <a
                href="#"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password
              </a>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent">
        <Button type="submit" form="login-form" className="w-full">
          Sign in
        </Button>
      </CardFooter>
    </Card>
  )
}
