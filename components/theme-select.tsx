"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { applyThemeChoice, type ThemeChoice } from "@/lib/theme-transition"
import { themeChoices } from "@/lib/themes"
import { cn } from "@/lib/utils"

const subscribeNever = () => () => {}

const chrome: Record<
  Exclude<ThemeChoice, "system">,
  { bg: string; side: string; bar: string; card: string; ink: string; accent: string }
> = {
  light: {
    bg: "bg-[#fafafc]",
    side: "bg-white",
    bar: "bg-[#e4e4eb]",
    card: "bg-white shadow-[0_0_0_1px_#e4e4eb]",
    ink: "bg-[#1c1c28]/25",
    accent: "bg-[#3e7bfa]",
  },
  dark: {
    bg: "bg-[#1c1c28]",
    side: "bg-[#16161f]",
    bar: "bg-[#34354d]",
    card: "bg-[#28293d]",
    ink: "bg-white/35",
    accent: "bg-[#3e7bfa]",
  },
  neutral: {
    bg: "bg-[#2b2b2b]",
    side: "bg-[#242424]",
    bar: "bg-[#454545]",
    card: "bg-[#3a3a3a]",
    ink: "bg-white/30",
    accent: "bg-[#3e7bfa]",
  },
  "authkit-light": {
    bg: "bg-white",
    side: "bg-[#fafafa]",
    bar: "bg-[#e4e4e7]",
    card: "bg-white shadow-[0_0_0_1px_#e4e4e7]",
    ink: "bg-[#111113]/25",
    accent: "bg-[#111113]",
  },
  authkit: {
    bg: "bg-[#0c0c0d]",
    side: "bg-[#09090b]",
    bar: "bg-[#27272a]",
    card: "bg-[#18181b]",
    ink: "bg-white/30",
    accent: "bg-[#eeeeef]",
  },
  "authkit-sharp": {
    bg: "bg-[#0c0c0d]",
    side: "bg-[#09090b]",
    bar: "bg-[#27272a]",
    card: "bg-[#18181b]",
    ink: "bg-white/30",
    accent: "bg-[#eeeeef]",
  },
}

function ThemeChrome({ tone }: { tone: Exclude<ThemeChoice, "system"> }) {
  const c = chrome[tone]
  const sharp = tone === "authkit-sharp"
  const rounded = tone === "authkit" || tone === "authkit-light"
  const corner = sharp ? "rounded-none" : rounded ? "rounded-xl" : "rounded-lg"
  const chip = sharp ? "rounded-none" : "rounded-full"
  const tile = sharp ? "rounded-none" : "rounded-md"
  return (
    <div className={cn("flex h-[4.5rem] w-full overflow-hidden", corner, c.bg)}>
      <div className={cn("flex w-[30%] flex-col gap-1 p-1.5", c.side)}>
        <div className={cn("h-1 w-full", chip, c.ink)} />
        <div className={cn("h-1 w-4/5 opacity-50", chip, c.ink)} />
        <div className={cn("h-1 w-3/5 opacity-50", chip, c.ink)} />
        <div className={cn("mt-auto h-1.5 w-1.5", chip, c.accent)} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className={cn("h-1.5 w-1/2", tile, c.bar)} />
        <div className={cn("min-h-0 flex-1", tile, c.card)} />
        <div className={cn("min-h-0 flex-1", tile, c.card)} />
      </div>
    </div>
  )
}

function ThemePreview({ mode }: { mode: ThemeChoice }) {
  if (mode === "system") {
    return (
      <div className="relative overflow-hidden rounded-lg">
        <ThemeChrome tone="light" />
        <div
          className="absolute inset-0"
          style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }}
        >
          <ThemeChrome tone="dark" />
        </div>
      </div>
    )
  }
  return <ThemeChrome tone={mode} />
}

export function ThemeSelect() {
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
      className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2.5"
    >
      {themeChoices.map((option) => {
        const active = selected === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!mounted}
            onClick={() =>
              applyThemeChoice(option.value, resolvedTheme, setTheme)
            }
            className={cn(
              "flex flex-col gap-2 rounded-xl p-1.5 text-left outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/5 shadow-[0_0_0_2px_var(--color-primary)]"
                : "shadow-[0_0_0_1px_var(--color-border)] hover:bg-muted/50 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_20%,transparent)]",
            )}
          >
            <ThemePreview mode={option.value} />
            <span className="flex items-center gap-2 px-1 pb-0.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full border",
                  active
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40",
                )}
              >
                {active && (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
