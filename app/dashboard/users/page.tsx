import { requireSession } from "@/lib/auth/session"
import { listUsers } from "@/lib/user-repository"
import { UsersTable } from "@/components/users-table"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  await requireSession()
  const users = await listUsers()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage local accounts that can sign into this portal.
        </p>
      </div>
      <UsersTable initialData={users} />
    </div>
  )
}
