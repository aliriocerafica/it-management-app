import { SettingsActions } from "@/components/settings-actions"

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure portal preferences.
        </p>
      </div>

      <SettingsActions />
    </div>
  )
}
