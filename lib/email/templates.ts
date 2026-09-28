export function otpEmailHtml(code: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 8px;">Password reset code</h2>
      <p style="color: #444;">Use the code below to reset your IT Asset Management password. It expires in 10 minutes.</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; margin: 24px 0;">${code}</p>
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `.trim()
}
