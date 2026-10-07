function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(title: string, body: string) {
  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:20px;font-weight:700;letter-spacing:0.08em;color:#b42318;">ARDENT</div>
        <div style="margin-top:4px;font-size:12px;color:#71717a;">IT Asset Management</div>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${title}</h1>
        ${body}
      </div>
    </div>
  </div>
  `.trim()
}

export function otpEmailHtml(code: string, copyUrl: string): string {
  const safe = escapeHtml(code)
  const safeUrl = escapeHtml(copyUrl)
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:24px 8px;">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.4;color:#111111;">
        Your password reset code:
      </p>
      <p style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:6px;font-family:Consolas,'Courier New',monospace;color:#111111;-webkit-user-select:all;user-select:all;">
        ${safe}
      </p>
      <p style="margin:0 0 20px;">
        <a href="${safeUrl}" style="display:inline-block;padding:8px 14px;border:1px solid #111111;color:#111111;text-decoration:none;font-size:14px;line-height:1.2;">
          Copy code
        </a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#555555;">
        Expires in 10 minutes. If you did not request this, you can ignore this email.
      </p>
    </td>
  </tr>
</table>
  `.trim()
}

export function otpEmailText(code: string): string {
  return [
    `Your password reset code: ${code}`,
    "",
    "Expires in 10 minutes. If you did not request this, you can ignore this email.",
  ].join("\n")
}

export function accountCreatedEmailHtml(name: string, loginUrl: string): string {
  const safeName = escapeHtml(name)
  const safeUrl = escapeHtml(loginUrl)
  return layout(
    "Your IT portal account is ready",
    `
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Hi ${safeName}, an account was created for you on the Ardent IT Asset Management portal.
      </p>
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Sign in here: <a href="${safeUrl}" style="color:#b42318;">${safeUrl}</a>
      </p>
      <p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
        If you don't have a password yet, use Forgot password on the sign-in page.
      </p>
    `,
  )
}

export function accountCreatedEmailText(name: string, loginUrl: string): string {
  return [
    "Your IT portal account is ready",
    "",
    `Hi ${name}, an account was created for you on the Ardent IT Asset Management portal.`,
    `Sign in here: ${loginUrl}`,
    "",
    "If you don't have a password yet, use Forgot password on the sign-in page.",
  ].join("\n")
}

export function accountabilityFormEmailHtml(
  name: string,
  version: number,
  itOfficerName: string,
): string {
  return layout(
    "Your accountability form",
    `
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Hi ${escapeHtml(name)}, attached is a copy of your IT equipment accountability form (version ${version}).
      </p>
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        It lists the company equipment currently assigned to you. Please keep it for your records and let IT know if anything on it is wrong.
      </p>
      <p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
        Sent by ${escapeHtml(itOfficerName)}, IT Department.
      </p>
    `,
  )
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function assetLabel(quantity: number, assetType: string) {
  return quantity > 1 ? `${quantity}× ${assetType}` : assetType
}

export type RequestEmailKind = "pending" | "approved" | "denied" | "completed"

const requestEmailCopy: Record<
  RequestEmailKind,
  { icon: string; title: string; subject: string; subtitle: string }
> = {
  pending: {
    icon: "&#8943;",
    title: "Request received",
    subject: "Request received",
    subtitle: "we received your request for",
  },
  approved: {
    icon: "&#10003;",
    title: "Request approved",
    subject: "Request approved",
    subtitle: "your request for",
  },
  completed: {
    icon: "&#10003;",
    title: "Request completed",
    subject: "Request completed",
    subtitle: "your request for",
  },
  denied: {
    icon: "&#10005;",
    title: "Request denied",
    subject: "Request denied",
    subtitle: "your request for",
  },
}

function simpleEmail({
  icon,
  title,
  subtitle,
  body,
  button,
  footer,
}: {
  icon: string
  title: string
  subtitle: string
  body?: string
  button?: { label: string; href: string }
  footer: string
}) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:440px;background:#ffffff;">
        <tr>
          <td align="center" style="padding:48px 40px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td width="8" height="8" bgcolor="#e11d2e" style="border-radius:4px;font-size:0;line-height:8px;">&nbsp;</td>
                <td style="padding-left:8px;font-size:13px;font-weight:600;color:#111111;letter-spacing:0.01em;">Ardent</td>
              </tr>
            </table>
            <div style="height:36px;line-height:36px;font-size:0;">&nbsp;</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td width="56" height="56" align="center" valign="middle" style="border:1.5px solid #111111;border-radius:28px;font-size:20px;color:#111111;line-height:56px;">
                  ${icon}
                </td>
              </tr>
            </table>
            <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
            <p style="margin:0 0 8px;font-size:26px;line-height:1.25;font-weight:700;color:#111111;">
              ${title}
            </p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#8a8a8a;">
              ${subtitle}
            </p>
            ${
              body
                ? `<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="left" style="padding:16px 18px;border:1px solid #ececec;font-size:14px;line-height:1.5;color:#111111;">
                  ${body}
                </td>
              </tr>
            </table>`
                : ""
            }
            ${
              button
                ? `<div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" bgcolor="#e8f6e8" style="background:#e8f6e8;border-radius:8px;">
                  <a href="${escapeHtml(button.href)}" style="display:block;padding:14px 20px;font-size:14px;font-weight:600;color:#111111;text-decoration:none;">
                    ${escapeHtml(button.label)}
                  </a>
                </td>
              </tr>
            </table>`
                : ""
            }
            <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9a9a9a;">
              ${footer}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `.trim()
}

export function assetRequestStatusEmail(kind: RequestEmailKind, input: {
  name: string
  assetType: string
  quantity: number
  note?: string | null
}): { subject: string; html: string; text: string } {
  const copy = requestEmailCopy[kind]
  const asset = assetLabel(input.quantity, input.assetType)
  const name = firstName(input.name)
  const ending =
    kind === "pending"
      ? "."
      : kind === "approved"
        ? " was approved."
        : kind === "completed"
          ? " is complete."
          : " was denied."
  const subtitle = `Hi ${name}, ${copy.subtitle} ${asset}${ending}`
  const note = input.note?.trim()
  return {
    subject: `${copy.subject}: ${asset}`,
    html: simpleEmail({
      icon: copy.icon,
      title: copy.title,
      subtitle: escapeHtml(subtitle),
      body: note ? escapeHtml(note).replace(/\n/g, "<br>") : undefined,
      button: {
        label: "Email IT",
        href: "mailto:it@ardentparalegal.com",
      },
      footer:
        'Prefer Slack? Message the IT department.<br><a href="mailto:it@ardentparalegal.com" style="color:#111111;text-decoration:underline;">it@ardentparalegal.com</a>',
    }),
    text: [
      subtitle,
      "",
      ...(note ? [note, ""] : []),
      "Questions? Message IT on Slack or it@ardentparalegal.com",
    ].join("\n"),
  }
}

export function assetRequestDeniedEmailHtml(input: {
  name: string
  code: string
  assetType: string
  quantity: number
  note: string
}): string {
  return assetRequestStatusEmail("denied", input).html
}

export function assetRequestDeniedEmailText(input: {
  name: string
  code: string
  assetType: string
  quantity: number
  note: string
}): string {
  return assetRequestStatusEmail("denied", input).text
}

export function accountabilityFormEmailText(
  name: string,
  version: number,
  itOfficerName: string,
): string {
  return [
    `Hi ${name}, attached is a copy of your IT equipment accountability form (version ${version}).`,
    "",
    "It lists the company equipment currently assigned to you. Please keep it for your records and let IT know if anything on it is wrong.",
    "",
    `Sent by ${itOfficerName}, IT Department.`,
  ].join("\n")
}
