import type { AssetRequest } from "@/lib/asset-requests"
import { requestCode } from "@/lib/asset-requests"
import { EmailSendError, sendEmail } from "@/lib/email/brevo"
import {
  assetRequestDeniedEmailHtml,
  assetRequestDeniedEmailText,
} from "@/lib/email/templates"
import { lookupDtrEmployeeEmail } from "@/lib/dtr"
import { fetchHrisEmployees } from "@/lib/hris"
import { listActiveItEmails } from "@/lib/user-repository"

const itInbox = "it@ardentparalegal.com"

async function employeeEmailFor(request: AssetRequest): Promise<string | null> {
  const stored = request.requesterEmail?.trim()
  if (stored) return stored
  if (request.source === "dtr" && request.employeeId) {
    const fromDtr = await lookupDtrEmployeeEmail(request.employeeId)
    if (fromDtr) return fromDtr
  }
  if (!request.employeeId && !request.requesterName) return null
  try {
    const employees = await fetchHrisEmployees("all")
    const id = request.employeeId?.trim().toUpperCase()
    const byId = employees.find(
      (employee) => employee.id.trim().toUpperCase() === id,
    )
    const byName = employees.find(
      (employee) =>
        employee.name.trim().toLowerCase() ===
        request.requesterName.trim().toLowerCase(),
    )
    return byId?.email.trim() || byName?.email.trim() || null
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
    throw new EmailSendError(
      `Request denied, but no email was found for ${request.requesterName} so the notice was not sent.`,
      422,
    )
  }

  const details = {
    name: request.requesterName,
    code: requestCode(request),
    assetType: request.assetType,
    quantity: request.quantity,
    note,
  }

  const itEmails = await listActiveItEmails()
  await sendEmail({
    to,
    cc: itEmails,
    replyTo: itInbox,
    subject: `Request denied: ${
      details.quantity > 1
        ? `${details.quantity}× ${details.assetType}`
        : details.assetType
    }`,
    htmlContent: assetRequestDeniedEmailHtml(details),
    textContent: assetRequestDeniedEmailText(details),
  })
}

export type AssetRequestSave = AssetRequest & { emailWarning?: string }

export async function withDenialEmail(
  request: AssetRequest,
): Promise<AssetRequestSave> {
  try {
    await notifyAssetRequestDenied(request)
    return request
  } catch (error) {
    console.error("[email:error] Denial email failed", error)
    return {
      ...request,
      emailWarning:
        error instanceof EmailSendError
          ? error.message
          : "Request denied, but the email could not be sent. Authorize this app's IP in Brevo, then deny again, or notify the employee another way.",
    }
  }
}
