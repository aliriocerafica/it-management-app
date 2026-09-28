type SendEmailInput = {
  to: string
  subject: string
  htmlContent: string
}

/**
 * Sends transactional email via Brevo. Until BREVO_API_KEY is configured,
 * this no-ops and logs to the console so local dev / OTP testing still works.
 */
export async function sendEmail({ to, subject, htmlContent }: SendEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.log(
      `[email:noop] BREVO_API_KEY not set — would have sent to=${to} subject=${subject} htmlContent=${htmlContent}`,
    )
    return
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@example.com"
  const senderName = process.env.BREVO_SENDER_NAME || "IT Asset Management"

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error("[email:error] Brevo send failed", response.status, body)
    }
  } catch (error) {
    console.error("[email:error] Brevo request failed", error)
  }
}
