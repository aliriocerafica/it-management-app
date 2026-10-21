import { LoginForm } from "@/components/login-form"
import { InactivityLogoutNotice } from "@/components/session-timeout"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason

  return (
    <div className="relative z-10 flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background p-6 authkit:bg-transparent">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black_10%,transparent_75%)] opacity-60 authkit:hidden"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">
        <InactivityLogoutNotice show={reason === "inactivity"} />
        <LoginForm />
      </div>
    </div>
  )
}
