import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
          IT Management
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Manage assets, tickets, and users in one place
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            A simple portal for your IT team to track inventory, handle support
            requests, and keep operations organized.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Get started
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              View dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
