type SendEmailInput = {
  to: string
  cc?: string[]
  replyTo?: string
  subject: string
  htmlContent: string
  textContent?: string
  // Base64-encoded files, e.g. a PDF.
  attachments?: { name: string; content: string }[]
}

export class EmailSendError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = "EmailSendError"
    this.status = status
  }
}

function publicEmailError(status: number, brevoMessage: string) {
  if (status === 401 && /unrecognised IP address/i.test(brevoMessage)) {
    return "Brevo blocked this server IP. Add it under Security → Authorised IPs, or turn off IP restriction for this API key."
  }
  if (status === 401) {
    return "Brevo rejected the API key. Check BREVO_API_KEY."
  }
  return "We couldn't send the email right now. Please try again."
}

/**
 * Sends transactional email via Brevo.
 */
export async function sendEmail({
  to,
  cc,
  replyTo: replyToOverride,
  subject,
  htmlContent,
  textContent,
  attachments,
}: SendEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim()

  if (!apiKey) {
    throw new EmailSendError(
      "BREVO_API_KEY is not set. Add it in .env to send email.",
      503,
    )
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "no-reply@example.com"
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "IT Asset Management"
  const replyTo = replyToOverride?.trim() || process.env.BREVO_REPLY_TO?.trim()
  const ccRecipients = [
    ...new Set(
      (cc ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email && email !== to.trim().toLowerCase()),
    ),
  ].map((email) => ({ email }))

  let response: Response
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        ...(ccRecipients.length ? { cc: ccRecipients } : {}),
        ...(replyTo ? { replyTo: { email: replyTo, name: senderName } } : {}),
        subject,
        htmlContent,
        textContent:
          textContent ??
          htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        ...(attachments?.length ? { attachment: attachments } : {}),
      }),
    })
  } catch (error) {
    console.error("[email:error] Brevo request failed", error)
    throw new EmailSendError("We couldn't reach the email service. Please try again.")
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error("[email:error] Brevo send failed", response.status, body)
    let brevoMessage = body
    try {
      brevoMessage = (JSON.parse(body) as { message?: string }).message ?? body
    } catch {
      // keep raw body
    }
    throw new EmailSendError(publicEmailError(response.status, brevoMessage), response.status)
  }
}
