import { ProfileForm } from "@/components/profile-form"
import { SettingsActions } from "@/components/settings-actions"
import { requireSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await requireSession()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account details and photo.
        </p>
      </div>

      <ProfileForm user={user} />

      <SettingsActions />
    </div>
  )
}
