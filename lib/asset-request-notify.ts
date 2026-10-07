import type { AssetRequest } from "@/lib/asset-requests"
import { requestCode } from "@/lib/asset-requests"
import { sendEmail } from "@/lib/email/brevo"
import {
  assetRequestDeniedEmailHtml,
  assetRequestDeniedEmailText,
} from "@/lib/email/templates"
import { fetchHrisEmployees } from "@/lib/hris"
import { listActiveItEmails } from "@/lib/user-repository"

const itInbox = "it@ardentparalegal.com"

async function employeeEmailFor(request: AssetRequest): Promise<string | null> {
  const stored = request.requesterEmail?.trim()
  if (stored) return stored
  if (!request.employeeId) return null
  try {
    const employees = await fetchHrisEmployees("all")
    const match = employees.find((employee) => employee.id === request.employeeId)
    const email = match?.email?.trim()
    return email || null
  } catch (error) {
    console.warn("Couldn't look up employee email for denied request", error)
    return null
  }
}

export async function notifyAssetRequestDenied(request: AssetRequest) {
  const note = request.resolutionNote?.trim()
  if (!note) return

  const to = await employeeEmailFor(request)
  if (!to) {
    console.warn(
      `No HRIS email for denied request ${requestCode(request)}; the note was saved but not sent.`,
    )
    return
  }

  const details = {
    name: request.requesterName,
    code: requestCode(request),
    assetType: request.assetType,
    quantity: request.quantity,
    note,
  }

  try {
    const itEmails = await listActiveItEmails()
    await sendEmail({
      to,
      cc: itEmails,
      replyTo: itInbox,
      subject: `${details.code}: your asset request was denied`,
      htmlContent: assetRequestDeniedEmailHtml(details),
      textContent: assetRequestDeniedEmailText(details),
    })
  } catch (error) {
    console.error("[email:error] Denial email failed", error)
  }
}
