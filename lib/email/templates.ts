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

const itFollowUp =
  "If you think this action was incorrect, message the IT department on Slack or email it@ardentparalegal.com."

export function assetRequestDeniedEmailHtml(input: {
  name: string
  code: string
  assetType: string
  quantity: number
  note: string
}): string {
  const asset =
    input.quantity > 1
      ? `${input.quantity}× ${escapeHtml(input.assetType)}`
      : escapeHtml(input.assetType)
  const note = escapeHtml(input.note).replace(/\n/g, "<br>")
  return layout(
    "Your asset request was denied",
    `
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Hi ${escapeHtml(input.name)}, IT has denied your request ${escapeHtml(input.code)} for ${asset}.
      </p>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Reason from IT:
      </p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;color:#18181b;font-size:14px;line-height:1.5;">
        ${note}
      </p>
      <p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.5;">
        If you think this action was incorrect, message the IT department on Slack or email
        <a href="mailto:it@ardentparalegal.com" style="color:#b42318;">it@ardentparalegal.com</a>.
      </p>
    `,
  )
}

export function assetRequestDeniedEmailText(input: {
  name: string
  code: string
  assetType: string
  quantity: number
  note: string
}): string {
  const asset =
    input.quantity > 1 ? `${input.quantity}× ${input.assetType}` : input.assetType
  return [
    "Your asset request was denied",
    "",
    `Hi ${input.name}, IT has denied your request ${input.code} for ${asset}.`,
    "",
    "Reason from IT:",
    input.note,
    "",
    itFollowUp,
  ].join("\n")
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
