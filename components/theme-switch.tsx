"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { applyThemeChoice, type ThemeChoice } from "@/lib/theme-transition"
import { themeChoices } from "@/lib/themes"
import { cn } from "@/lib/utils"

const subscribeNever = () => () => {}

export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
  const selected = mounted ? ((theme ?? "system") as ThemeChoice) : "system"

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "grid grid-cols-6 gap-0.5 rounded-xl bg-muted/70 p-0.5 dark:bg-muted/40",
        className,
      )}
    >
      {themeChoices.map((option) => {
        const active = selected === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            disabled={!mounted}
            onClick={() =>
              applyThemeChoice(option.value, resolvedTheme, setTheme)
            }
            className={cn(
              "flex h-8 items-center justify-center rounded-lg text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
