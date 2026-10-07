import type { Employee } from "@/lib/employees"

// Server-side client for the HRIS employee directory feed
// (ardent-hris-app: GET /api/integrations/employees).
type HrisEmployee = {
  employeeNo: string
  fullName: string
  email: string | null
  departmentCode: string | null
  departmentName: string | null
  positionTitle: string | null
  isActive: boolean
}

export async function fetchHrisEmployees(
  status: "active" | "all" = "active",
): Promise<Employee[]> {
  const baseUrl = process.env.HRIS_API_URL
  const apiKey = process.env.IT_SYSTEM_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error("HRIS_API_URL and IT_SYSTEM_API_KEY must be set.")
  }

  const response = await fetch(
    new URL(`/api/integrations/employees?status=${status}`, baseUrl),
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      // The directory changes rarely; refresh at most every 5 minutes.
      next: { revalidate: 300 },
    },
  )
  if (!response.ok) {
    throw new Error(`HRIS responded with ${response.status}.`)
  }

  const data = (await response.json()) as { employees: HrisEmployee[] }
  return data.employees.map((e) => ({
    id: e.employeeNo,
    name: e.fullName,
    department: e.departmentName ?? "",
    departmentCode: e.departmentCode ?? "",
    title: e.positionTitle ?? "",
    email: e.email ?? "",
  }))
}

export async function withRequesterEmails<T extends {
  employeeId: string | null
  requesterEmail?: string | null
}>(requests: T[]): Promise<T[]> {
  const missing = requests.filter(
    (request) => !request.requesterEmail?.trim() && request.employeeId,
  )
  if (missing.length === 0) return requests

  try {
    const employees = await fetchHrisEmployees("all")
    const emailById = new Map(
      employees.map((employee) => [
        employee.id,
        employee.email.trim() || null,
      ]),
    )
    return requests.map((request) => {
      if (request.requesterEmail?.trim()) return request
      const email = request.employeeId
        ? emailById.get(request.employeeId) ?? null
        : null
      return email ? { ...request, requesterEmail: email } : request
    })
  } catch (error) {
    console.warn("Couldn't attach employee emails from HRIS", error)
    return requests
  }
}
