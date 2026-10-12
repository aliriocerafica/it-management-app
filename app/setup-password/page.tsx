import Link from "next/link"

import { SetupPasswordForm } from "@/components/setup-password-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { findSetupToken } from "@/lib/auth/setup-link"

export const dynamic = "force-dynamic"

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token } = await searchParams
  const setup = typeof token === "string" ? await findSetupToken(token) : null

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {setup ? (
        <SetupPasswordForm
          token={token as string}
          name={setup.user.name}
          email={setup.user.email}
        />
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Link invalid or expired</CardTitle>
            <CardDescription>
              Setup links work once and expire after a few days. Ask IT to send you a new
              one. If you already set your password, just sign in.
            </CardDescription>
          </CardHeader>
          <CardFooter className="border-t-0 bg-transparent">
            <Link href="/login" className={buttonVariants({ className: "w-full" })}>
              Go to sign in
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
