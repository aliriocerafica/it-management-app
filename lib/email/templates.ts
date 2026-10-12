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
    "Your IT Management account is ready",
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
    "Your IT Management account is ready",
    "",
    `Hi ${name}, an account was created for you on the Ardent IT Asset Management portal.`,
    `Sign in here: ${loginUrl}`,
    "",
    "If you don't have a password yet, use Forgot password on the sign-in page.",
  ].join("\n")
}

export function setupLinkEmailHtml(name: string, setupUrl: string, ttlHours: number): string {
  const safeUrl = escapeHtml(setupUrl)
  return layout(
    "Set up your account",
    `
      <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.5;">
        Hi ${escapeHtml(name)}, an account was created for you on the Ardent IT Asset Management portal. Choose a password to finish setting it up.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${safeUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
          Set your password
        </a>
      </p>
      <p style="margin:0 0 8px;color:#71717a;font-size:12px;line-height:1.5;">
        Or paste this link into your browser: <a href="${safeUrl}" style="color:#b42318;word-break:break-all;">${safeUrl}</a>
      </p>
      <p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
        The link works once and expires in ${ttlHours} hours. If it expires, ask IT to send a new one.
      </p>
    `,
  )
}

export function setupLinkEmailText(name: string, setupUrl: string, ttlHours: number): string {
  return [
    `Hi ${name}, an account was created for you on the Ardent IT Asset Management portal.`,
    "",
    `Choose a password to finish setting it up: ${setupUrl}`,
    "",
    `The link works once and expires in ${ttlHours} hours. If it expires, ask IT to send a new one.`,
  ].join("\n")
}

// Where the holder uploads the signed copy, and how long the link lasts.
export type SignedCopyUpload = { url: string; days: number }

export function accountabilityFormEmailHtml(
  name: string,
  version: number,
  upload?: SignedCopyUpload,
): string {
  const safeUrl = upload ? escapeHtml(upload.url) : ""
  const text = "margin:0;font-size:14px;line-height:1.5;color:#3f3f46;"
  const step = (number: number, label: string) =>
    `<tr>
                <td valign="top" style="padding:0 10px 8px 0;font-size:14px;line-height:1.5;font-weight:700;color:#111111;white-space:nowrap;">Step ${number}</td>
                <td valign="top" style="padding:0 0 8px;font-size:14px;line-height:1.5;color:#3f3f46;">${label}</td>
              </tr>`
  const message = upload
    ? `<p style="${text}margin-bottom:14px;">
              It lists the company equipment currently assigned to you.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              ${step(1, "Print the attached form and sign it.")}
              ${step(2, "Upload a scan or clear photo of the signed copy.")}
            </table>`
    : `<p style="${text}">
              It lists the company equipment currently assigned to you. Please keep it for your records and let IT know if anything on it is wrong.
            </p>`
  const action = upload
    ? { label: "Upload signed copy", href: safeUrl }
    : { label: "Email IT", href: "mailto:it@ardentparalegal.com" }
  const note = upload
    ? `<p style="margin:10px 0 0;font-size:11px;line-height:1.5;color:#9a9a9a;text-align:center;">
              Only for you. Expires in ${upload.days} days.
            </p>`
    : ""
  const fallback = upload
    ? `<tr>
          <td style="padding:14px 32px 20px;border-top:1px solid #ececec;font-size:11px;line-height:1.5;color:#9a9a9a;">
            Button not working? Paste this link into your browser:
            <a href="${safeUrl}" style="color:#6b6b6b;text-decoration:underline;word-break:break-all;">${safeUrl}</a>
          </td>
        </tr>`
    : ""
  return wideEmail({
    title: "Your accountability form",
    subtitle: `Hi ${firstName(name)}, your IT equipment accountability form (version ${version}) is attached.`,
    message,
    action,
    note,
    fallback,
  })
}

// A wide, short card: the message on the left, the one action on the
// right. The two halves are inline blocks, so they stack on a narrow screen.
// `title`, `subtitle` and the action label are escaped here; `message`,
// `note` and `fallback` are HTML, and `action.href` is already escaped.
function wideEmail({
  title,
  subtitle,
  message,
  action,
  note = "",
  fallback = "",
}: {
  title: string
  subtitle: string
  message: string
  action: { label: string; href: string }
  note?: string
  fallback?: string
}) {
  const half =
    "display:inline-block;vertical-align:middle;width:100%;text-align:left;"
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background:#ffffff;">
        <tr>
          <td align="center" style="padding:28px 32px 24px;font-size:0;">
            <div style="${half}max-width:372px;">
              <div style="padding:0 16px 12px 0;">
                <p style="margin:0 0 6px;font-size:22px;line-height:1.25;font-weight:700;color:#111111;">
                  ${escapeHtml(title)}
                </p>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#8a8a8a;">
                  ${escapeHtml(subtitle)}
                </p>
                ${message}
              </div>
            </div>
            <div style="${half}max-width:236px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#111111" style="background:#111111;border-radius:8px;">
                    <a href="${action.href}" style="display:block;padding:14px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      ${escapeHtml(action.label)}
                    </a>
                  </td>
                </tr>
              </table>
              ${note}
            </div>
          </td>
        </tr>
        ${fallback}
      </table>
    </td>
  </tr>
</table>
  `.trim()
}

// Tells a form's signatories that its holder sent back the signed copy.
export function signedCopyReceivedEmail(input: {
  holderName: string
  version: number
  // The Accountability page, where the copy can be opened.
  pageUrl: string
}): { subject: string; html: string; text: string } {
  const summary = `${input.holderName} uploaded the signed copy of their IT equipment accountability form (version ${input.version}).`
  const next =
    "It is now marked as signed. Open the Accountability page to view the signed copy."
  return {
    subject: `Signed accountability form received: ${input.holderName}`,
    html: wideEmail({
      title: "Signed copy received",
      subtitle: summary,
      message: `<p style="margin:0;font-size:14px;line-height:1.5;color:#3f3f46;">${next}</p>`,
      action: { label: "Open Accountability", href: escapeHtml(input.pageUrl) },
    }),
    text: [summary, "", next, input.pageUrl].join("\n"),
  }
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function assetLabel(quantity: number, assetType: string) {
  return quantity > 1 ? `${quantity}× ${assetType}` : assetType
}

export type RequestEmailKind =
  | "pending"
  | "approved"
  | "denied"
  | "completed"
  | "issued"

export type RequestEmailDetail = { label: string; value: string }

function lordIcon(src: string, alt: string) {
  return `<img src="${src}" width="72" height="72" alt="${escapeHtml(alt)}" style="display:block;margin:0 auto;border:0;width:72px;height:72px;" />`
}

const requestEmailCopy: Record<
  RequestEmailKind,
  { icon: string; title: string; subject: string; subtitle: string }
> = {
  pending: {
    icon: lordIcon(
      "https://media.lordicon.com/icons/system/outline/145-mail.gif",
      "Request received",
    ),
    title: "Request received",
    subject: "Request received",
    subtitle: "we received your request for",
  },
  approved: {
    icon: lordIcon(
      "https://media.lordicon.com/icons/system/outline/24-check-circle.gif",
      "Request approved",
    ),
    title: "Request approved",
    subject: "Request approved",
    subtitle: "your request for",
  },
  completed: {
    icon: lordIcon(
      "https://media.lordicon.com/icons/system/outline/24-check-circle.gif",
      "Request completed",
    ),
    title: "Request completed",
    subject: "Request completed",
    subtitle: "your request for",
  },
  issued: {
    icon: lordIcon(
      "https://media.lordicon.com/icons/system/outline/24-check-circle.gif",
      "Asset issued",
    ),
    title: "Asset issued",
    subject: "Asset issued",
    subtitle: "your",
  },
  denied: {
    icon: lordIcon(
      "https://media.lordicon.com/icons/system/outline/25-cross-circle.gif",
      "Request denied",
    ),
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
            ${icon}
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
                <td align="center" bgcolor="#111111" style="background:#111111;border-radius:8px;">
                  <a href="${escapeHtml(button.href)}" style="display:block;padding:14px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
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
            <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#b0b0b0;">
              <a href="https://lordicon.com/" style="color:#b0b0b0;text-decoration:none;">Animated icons by Lordicon.com</a>
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
  details?: RequestEmailDetail[]
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
          : kind === "issued"
            ? " has been issued to you."
            : " was denied."
  const subtitle = `Hi ${name}, ${copy.subtitle} ${asset}${ending}`
  const note = input.note?.trim()
  const details = (input.details ?? []).filter((detail) => detail.value.trim())
  const body = [
    details
      .map(
        (detail) =>
          `<span style="color:#8a8a8a;">${escapeHtml(detail.label)}:</span> ${escapeHtml(detail.value)}`,
      )
      .join("<br>"),
    note ? escapeHtml(note).replace(/\n/g, "<br>") : "",
  ]
    .filter(Boolean)
    .join("<br><br>")
  return {
    subject: `${copy.subject}: ${asset}`,
    html: simpleEmail({
      icon: copy.icon,
      title: copy.title,
      subtitle: escapeHtml(subtitle),
      body: body || undefined,
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
      ...(details.length > 0
        ? [...details.map((detail) => `${detail.label}: ${detail.value}`), ""]
        : []),
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
  upload?: SignedCopyUpload,
): string {
  return [
    `Hi ${name}, attached is a copy of your IT equipment accountability form (version ${version}).`,
    "",
    "It lists the company equipment currently assigned to you. Please keep it for your records and let IT know if anything on it is wrong.",
    ...(upload
      ? [
          "",
          "Step 1: Print the attached form and sign it.",
          `Step 2: Upload a scan or clear photo of the signed copy here: ${upload.url}`,
          "",
          `The link is only for you and expires in ${upload.days} days.`,
        ]
      : []),
  ].join("\n")
}
