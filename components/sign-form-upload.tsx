"use client"

import * as React from "react"
import { CircleCheckIcon, FileTextIcon, Loader2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// Matches the server's limit.
const MAX_BYTES = 4 * 1024 * 1024
const MAX_SIDE = 2200

// Phone photos are often over the limit. Shrinks one to a JPEG that fits;
// anything that can't be shrunk is returned as it was.
async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_BYTES) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    )
    return blob ? new File([blob], "signed-form.jpg", { type: "image/jpeg" }) : file
  } catch {
    return file
  }
}

export function SignFormUpload({
  token,
  name,
  version,
  alreadySigned,
}: {
  token: string
  name: string
  version: number
  alreadySigned: boolean
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(alreadySigned)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setError(null)
    setPending(true)
    try {
      const upload = await shrinkPhoto(file)
      if (upload.size > MAX_BYTES) {
        setError("That file is too large. The limit is 4 MB.")
        return
      }
      const body = new FormData()
      body.set("token", token)
      body.set("file", upload)
      const response = await fetch("/api/sign-form", { method: "POST", body })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? "Couldn't upload the file. Try again.")
        return
      }
      setDone(true)
    } catch {
      setError("Couldn't upload the file. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CircleCheckIcon className="mx-auto size-10 text-emerald-500" />
          <CardTitle>Signed copy received</CardTitle>
          <CardDescription>
            Thanks, {name}. IT has the signed copy of your accountability form
            (version {version}). You can close this page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign your accountability form</CardTitle>
        <CardDescription>
          Hi {name}. Two steps to return your signed form (version {version})
          to IT.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="contents">
        <CardContent>
          <ol className="grid gap-5">
            <Step number={1} title="Print the form and sign it">
              <Button
                variant="outline"
                nativeButton={false}
                className="w-full"
                render={
                  <a
                    href={`/api/sign-form/pdf?token=${token}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <FileTextIcon />
                Open the form to print
              </Button>
            </Step>
            <Step number={2} title="Upload the signed copy">
              <Input
                id="signed-copy"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                aria-label="Signed copy"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setError(null)
                }}
                required
              />
              <p className="text-xs text-muted-foreground">
                A scan or a clear photo of the signed page. PDF, JPG or PNG, up
                to 4 MB.
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!file || pending}
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UploadIcon />
                )}
                {pending ? "Uploading…" : "Upload signed copy"}
              </Button>
            </Step>
          </ol>
        </CardContent>
      </form>
    </Card>
  )
}

// One numbered step, with its controls underneath the title.
function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
        {number}
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="text-sm leading-6 font-medium">{title}</p>
        {children}
      </div>
    </li>
  )
}
