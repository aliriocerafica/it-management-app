"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// next-themes renders an inline <script> that applies the saved theme before
// first paint. It only needs to run from the server HTML; React 19.2 warns
// about any <script> a component renders on the client. Marking it as JSON
// on the client silences that without changing what the server sends.
const scriptProps =
  typeof window === "undefined"
    ? undefined
    : ({ type: "application/json", suppressHydrationWarning: true } as const)

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider scriptProps={scriptProps} {...props}>
      {children}
    </NextThemesProvider>
  )
}
