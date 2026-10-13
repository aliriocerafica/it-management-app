import { ProfileForm } from "@/components/profile-form"
import { requireSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function SettingsProfilePage() {
  const user = await requireSession()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-sm font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your account details and photo.
        </p>
      </div>
      <ProfileForm user={user} />
    </div>
  )
}
