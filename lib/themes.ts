import {
  AppWindowIcon,
  BlendIcon,
  KeyRoundIcon,
  MonitorIcon,
  MoonIcon,
  SquareIcon,
  SunIcon,
} from "lucide-react"

export const themeChoices = [
  {
    value: "light",
    label: "Light",
    hint: "Bright surfaces",
    appearance: "light",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Low glare",
    appearance: "dark",
    icon: MoonIcon,
  },
  {
    value: "neutral",
    label: "Neutral",
    hint: "Soft grey",
    appearance: "dark",
    icon: BlendIcon,
  },
  {
    value: "authkit-light",
    label: "AuthKit Light",
    hint: "Rounded, black buttons",
    appearance: "light",
    icon: AppWindowIcon,
  },
  {
    value: "authkit",
    label: "AuthKit Dark",
    hint: "Rounded, Radix night",
    appearance: "dark",
    icon: KeyRoundIcon,
  },
  {
    value: "authkit-sharp",
    label: "AuthKit Sharp",
    hint: "Dark, no radius",
    appearance: "dark",
    icon: SquareIcon,
  },
  {
    value: "system",
    label: "System",
    hint: "Match this device",
    appearance: "system",
    icon: MonitorIcon,
  },
] as const

export type ThemeChoice = (typeof themeChoices)[number]["value"]

export const themeNames = themeChoices
  .map((option) => option.value)
  .filter((value) => value !== "system")

export function themeAppearance(
  theme: string | undefined,
): "light" | "dark" {
  return themeChoices.find((option) => option.value === theme)?.appearance ===
    "light"
    ? "light"
    : "dark"
}
