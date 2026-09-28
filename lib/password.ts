export const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password: string) => password.length >= 8,
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const

export function passwordChecks(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }))
}

export function isStrongPassword(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

export function passwordError(password: string) {
  if (isStrongPassword(password)) return null
  return "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character."
}
