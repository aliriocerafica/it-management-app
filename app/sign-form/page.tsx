import { SignFormUpload } from "@/components/sign-form-upload"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { findSignLink } from "@/lib/accountability-sign-link"

export const dynamic = "force-dynamic"

export default async function SignFormPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token } = await searchParams
  const link = typeof token === "string" ? await findSignLink(token) : null

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {link ? (
        <SignFormUpload
          token={token as string}
          name={link.form.holderName}
          version={link.form.version}
          alreadySigned={link.form.signedAt !== null}
        />
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Link invalid or expired</CardTitle>
            <CardDescription>
              Upload links expire after a couple of weeks. Ask IT to send your
              accountability form again to get a new one.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
