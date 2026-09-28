"use client"

import { CheckIcon, CircleIcon } from "lucide-react"

import { passwordChecks } from "@/lib/password"
import { cn } from "@/lib/utils"

export function PasswordRules({ password }: { password: string }) {
  const checks = passwordChecks(password)

  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            "flex items-center gap-2 text-xs",
            check.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {check.met ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CircleIcon className="size-3.5" />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  )
}
