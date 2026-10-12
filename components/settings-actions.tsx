"use client"

import * as React from "react"
import {
  FileTextIcon,
  LockIcon,
  MoonIcon,
  SparklesIcon,
  Volume2Icon,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { AccountabilityTemplateForm } from "@/components/accountability-template-form"
import { ChangePasswordForm } from "@/components/change-password-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  playThemeTransition,
  setThemeTransitionEnabled,
  useThemeTransitionEnabled,
} from "@/lib/theme-transition"
import { setUiSoundsEnabled, useUiSoundsEnabled } from "@/lib/ui-sounds"

const subscribeNever = () => () => {}

const switchClass = "data-checked:bg-blue-500 data-unchecked:bg-input"

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3 md:grid-cols-[14rem_1fr] md:gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="gap-0 divide-y divide-border py-0">{children}</Card>
    </section>
  )
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsActions() {
  const [accountabilityOpen, setAccountabilityOpen] = React.useState(false)
  const [accountabilityDirty, setAccountabilityDirty] = React.useState(false)
  const [securityOpen, setSecurityOpen] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const animationsEnabled = useThemeTransitionEnabled()
  const soundsEnabled = useUiSoundsEnabled()
  // True after hydration; the theme is only known on the client.
  const mounted = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <SettingsSection
        title="Appearance"
        description="How the portal looks in this browser."
      >
        <SettingsRow
          icon={MoonIcon}
          title="Dark mode"
          description="Use the dark colour theme."
        >
          <Switch
            checked={mounted && resolvedTheme === "dark"}
            onCheckedChange={(checked) => {
              const next = checked ? "dark" : "light"
              playThemeTransition(next, () => setTheme(next))
            }}
            disabled={!mounted}
            aria-label="Dark mode"
            className={switchClass}
          />
        </SettingsRow>
        <SettingsRow
          icon={SparklesIcon}
          title="Theme switch animation"
          description="Play the sunrise and sunset animation when switching between light and dark."
        >
          <Switch
            checked={animationsEnabled}
            onCheckedChange={setThemeTransitionEnabled}
            aria-label="Theme switch animation"
            className={switchClass}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Sound"
        description="What the portal plays in this browser."
      >
        <SettingsRow
          icon={Volume2Icon}
          title="Sound effects"
          description="Play a sound on clicks and when a dialog or menu opens."
        >
          <Switch
            checked={soundsEnabled}
            onCheckedChange={setUiSoundsEnabled}
            aria-label="Sound effects"
            className={switchClass}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Documents"
        description="Details used on generated paperwork."
      >
        <SettingsRow
          icon={FileTextIcon}
          title="Accountability form"
          description="The names and signatures printed on generated accountability forms."
        >
          <Dialog
            open={accountabilityOpen}
            onOpenChange={(open) => {
              // Closing with edits still unsaved asks first.
              if (
                !open &&
                accountabilityDirty &&
                !window.confirm("Close without saving your changes?")
              ) {
                return
              }
              setAccountabilityDirty(false)
              setAccountabilityOpen(open)
            }}
          >
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Edit
            </DialogTrigger>
            <DialogContent className="max-h-[min(90svh,40rem)] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Accountability form</DialogTitle>
                <DialogDescription>
                  The names and signatures printed on generated accountability forms.
                </DialogDescription>
              </DialogHeader>
              {accountabilityOpen ? (
                <AccountabilityTemplateForm
                  onDirtyChange={setAccountabilityDirty}
                />
              ) : null}
            </DialogContent>
          </Dialog>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Security"
        description="Keep your account protected."
      >
        <SettingsRow
          icon={LockIcon}
          title="Password"
          description="Update the password for this account."
        >
          <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Change
            </DialogTrigger>
            <DialogContent className="max-h-[min(90svh,40rem)] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>
                  Update the password for this account.
                </DialogDescription>
              </DialogHeader>
              {securityOpen ? <ChangePasswordForm /> : null}
            </DialogContent>
          </Dialog>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
