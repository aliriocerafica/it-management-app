import Link from "next/link"

import { LoginForm } from "@/components/login-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back
        </Link>
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </div>
  )
}
