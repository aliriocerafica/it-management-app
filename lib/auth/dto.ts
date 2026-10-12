export type SessionUser = {
  id: string
  name: string
  email: string
  role: "ADMIN" | "STAFF"
  avatarUrl: string | null
}
