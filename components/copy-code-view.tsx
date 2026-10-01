"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function normalizeCode(value: string | null) {
  return (value ?? "").replace(/\D/g, "").slice(0, 6)
}

export function CopyCodeView() {
  const searchParams = useSearchParams()
  const code = normalizeCode(searchParams.get("c"))
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const copy = React.useCallback(async (silent = false) => {
    if (code.length !== 6) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setError(null)
    } catch {
      if (!silent) {
        setError("Select the code and copy it yourself.")
      }
    }
  }, [code])

  // Try to copy on arrival; browsers may refuse without a click.
  React.useEffect(() => {
    if (code.length !== 6) return
    navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => {})
  }, [code])

  if (code.length !== 6) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-muted-foreground">This copy link is missing a code.</p>
        <Link
          href="/reset-password"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          Go to reset password
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-sm text-muted-foreground">
        {copied ? "Copied to clipboard." : "Your reset code"}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-[0.35em]">{code}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        <Button type="button" onClick={() => void copy()}>
          {copied ? "Copy again" : "Copy code"}
        </Button>
        <Link
          href="/reset-password"
          className={buttonVariants({ variant: "outline" })}
        >
          Continue to reset password
        </Link>
      </div>
    </div>
  )
}
