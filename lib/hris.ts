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
