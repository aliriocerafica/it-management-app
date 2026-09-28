"use client"

import * as React from "react"
import { FileTextIcon, LockIcon } from "lucide-react"

import { AccountabilityTemplateForm } from "@/components/accountability-template-form"
import { ChangePasswordForm } from "@/components/change-password-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function SettingsActions() {
  const [accountabilityOpen, setAccountabilityOpen] = React.useState(false)
  const [securityOpen, setSecurityOpen] = React.useState(false)

  return (
    <div className="flex flex-wrap gap-3">
      <Dialog open={accountabilityOpen} onOpenChange={setAccountabilityOpen}>
        <DialogTrigger render={<Button variant="outline" />}>
          <FileTextIcon />
          Accountability form
        </DialogTrigger>
        <DialogContent className="max-h-[min(90svh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accountability form</DialogTitle>
            <DialogDescription>
              These names are printed on generated accountability forms.
            </DialogDescription>
          </DialogHeader>
          {accountabilityOpen ? <AccountabilityTemplateForm /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogTrigger render={<Button variant="outline" />}>
          <LockIcon />
          Change password
        </DialogTrigger>
        <DialogContent className="max-h-[min(90svh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Update the password for this account.
            </DialogDescription>
          </DialogHeader>
          {securityOpen ? <ChangePasswordForm /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
