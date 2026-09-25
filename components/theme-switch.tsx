"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground",
        className
      )}
    >
      <span className={cn(!isDark && mounted && "font-medium text-foreground")}>
        Light
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        disabled={!mounted}
        aria-label="Toggle dark mode"
        className="data-checked:bg-blue-500 data-unchecked:bg-input"
      />
      <span className={cn(isDark && "font-medium text-foreground")}>Dark</span>
    </div>
  )
}
