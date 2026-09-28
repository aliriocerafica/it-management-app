import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
