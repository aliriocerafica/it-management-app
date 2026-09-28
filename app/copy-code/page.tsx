import { Suspense } from "react"

import { CopyCodeView } from "@/components/copy-code-view"

export const metadata = {
  title: "Copy reset code",
  robots: { index: false, follow: false },
}

export default function CopyCodePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <Suspense>
        <CopyCodeView />
      </Suspense>
    </div>
  )
}
