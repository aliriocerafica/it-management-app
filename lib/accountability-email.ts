import { recordFormSend, renderFormPdf } from "@/lib/accountability-repository"
import { signatoryEmails } from "@/lib/accountability-form-settings"
import {
  SIGN_LINK_TTL_DAYS,
  createSignLink,
} from "@/lib/accountability-sign-link"
import { appBaseUrl } from "@/lib/auth/setup-link"
import { sendEmail } from "@/lib/email/brevo"
import {
  accountabilityFormEmailHtml,
  accountabilityFormEmailText,
} from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"

// Emails one form version with the PDF attached, and records the send.
// Returns who was copied, or null when there's no such form. Throws when
// the email can't be sent.
export async function emailForm(
  request: Request,
  formId: string,
  to: string,
  sentByName: string | null,
): Promise<{ cc: string[] } | null> {
  const rendered = await renderFormPdf(formId)
  if (!rendered) return null
  const form = (await prisma.accountabilityForm.findUnique({
    where: { id: formId },
    select: { itOfficerName: true, hrName: true, signedAt: true },
  }))!
  // A form still waiting on its signature goes out with a private link for
  // uploading the signed copy.
  const upload = form.signedAt
    ? undefined
    : {
        url: `${appBaseUrl(request)}/sign-form?token=${await createSignLink(formId)}`,
        days: SIGN_LINK_TTL_DAYS,
      }

  // The form's signatories are kept in the loop.
  const cc = (await signatoryEmails(form)).filter(
    (email) => email.toLowerCase() !== to.toLowerCase(),
  )

  await sendEmail({
    to,
    cc,
    subject: `Your IT accountability form (v${rendered.version})`,
    htmlContent: accountabilityFormEmailHtml(rendered.holderName, rendered.version, upload),
    textContent: accountabilityFormEmailText(rendered.holderName, rendered.version, upload),
    attachments: [{ name: rendered.filename, content: rendered.pdf.toString("base64") }],
  })

  await recordFormSend(formId, to, sentByName)
  return { cc }
}
