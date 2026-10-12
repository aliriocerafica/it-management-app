import type { AssetRequest } from "@/lib/asset-requests"
import { EmailSendError, sendEmail } from "@/lib/email/brevo"
import {
  assetRequestStatusEmail,
  type RequestEmailDetail,
  type RequestEmailKind,
} from "@/lib/email/templates"
import { lookupDtrEmployeeEmail } from "@/lib/dtr"
import { fetchHrisEmployees } from "@/lib/hris"
import { listActiveItEmails } from "@/lib/user-repository"

const itInbox = "it@ardentparalegal.com"

export type { RequestEmailKind }

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
    console.warn("Couldn't look up employee email for request notice", error)
    return null
  }
}

function emailKindForStatus(
  status: AssetRequest["status"],
): RequestEmailKind | null {
  if (status === "Pending") return "pending"
  if (status === "Approved") return "approved"
  if (status === "Completed") return "completed"
  if (status === "Denied") return "denied"
  return null
}

export async function notifyAssetRequest(
  request: AssetRequest,
  kind: RequestEmailKind,
  details?: RequestEmailDetail[],
) {
  if (kind === "denied" && !request.resolutionNote?.trim()) return

  const to = await employeeEmailFor(request)
  if (!to) {
    throw new EmailSendError(
      `The request was updated, but no email was found for ${request.requesterName} so the notice was not sent.`,
      422,
    )
  }

  const email = assetRequestStatusEmail(kind, {
    name: request.requesterName,
    assetType: request.assetType,
    quantity: request.quantity,
    note:
      kind === "pending"
        ? request.reason
        : kind === "issued"
          ? null
          : request.resolutionNote,
    details,
  })

  const itEmails = await listActiveItEmails()
  await sendEmail({
    to,
    cc: itEmails,
    replyTo: itInbox,
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
  })
}

export type AssetRequestSave = AssetRequest & { emailWarning?: string }

export async function withRequestEmail(
  request: AssetRequest,
  kind: RequestEmailKind,
  details?: RequestEmailDetail[],
): Promise<AssetRequestSave> {
  try {
    await notifyAssetRequest(request, kind, details)
    return request
  } catch (error) {
    console.error(`[email:error] ${kind} email failed`, error)
    return {
      ...request,
      emailWarning:
        error instanceof EmailSendError
          ? error.message
          : "The request was updated, but the email could not be sent. Authorize this app's IP in Brevo, then try again, or notify the employee another way.",
    }
  }
}

export async function withStatusEmail(
  request: AssetRequest,
  previousStatus?: AssetRequest["status"] | null,
): Promise<AssetRequestSave> {
  const kind = emailKindForStatus(request.status)
  if (!kind || request.status === previousStatus) return request
  return withRequestEmail(request, kind)
}

export async function withDenialEmail(request: AssetRequest) {
  return withRequestEmail(request, "denied")
}
