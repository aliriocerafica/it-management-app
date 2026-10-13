import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AuthKitStarfield } from "@/components/authkit-starfield"
import { ThemeProvider } from "@/components/theme-provider"
import { UiSounds } from "@/components/ui-sounds"
import { themeNames } from "@/lib/themes"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "IT Management",
  description: "IT management portal",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="authkit"
          enableSystem
          disableTransitionOnChange
          themes={[...themeNames]}
        >
          <AuthKitStarfield />
          {children}
          <UiSounds />
        </ThemeProvider>
      </body>
    </html>
  )
}
