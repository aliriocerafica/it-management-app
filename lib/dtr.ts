import type { AssetRequest, RequestPriority, RequestStatus } from "@/lib/asset-requests"

// AURA (DTR) internal asset-request API.
// GET  /api/internal/assets/requests
// POST /api/internal/assets/requests/:id/issue
// POST /api/internal/assets/:issuedId/return

export const dtrIssueConditions = ["NEW", "GOOD", "FAIR", "POOR"] as const
export type DtrIssueCondition = (typeof dtrIssueConditions)[number]

export const dtrReturnConditions = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const
export type DtrReturnCondition = (typeof dtrReturnConditions)[number]

type DtrAssetStatus =
  | "SUBMITTED"
  | "SUPERVISOR_APPROVED"
  | "SUPERVISOR_REJECTED"
  | "ISSUED"
  | "CANCELLED"
  | "RETURNED"

type DtrAssetType =
  | "LAPTOP"
  | "LAPTOP_SET"
  | "MONITOR"
  | "CHAIR"
  | "PHONE"
  | "KEYBOARD"
  | "MOUSE"
  | "HEADSET"
  | "SUPPLIES"
  | "OTHER"

export type DtrAssetRequest = {
  id: string
  employeeNo: string
  employeeName: string
  department: string
  assetType: DtrAssetType
  otherDetail: string | null
  quantity: number
  urgency: "NORMAL" | "URGENT"
  description: string
  neededByDate: string | null
  status: DtrAssetStatus
  supervisorNote: string | null
  createdAt: string
  issued: {
    id: string
    serialNumber: string
    conditionIssued: string
    issuedAt: string
    returnedAt: string | null
    returnCondition: string | null
  } | null
}

const assetTypeLabels: Record<DtrAssetType, string> = {
  LAPTOP: "Laptop",
  LAPTOP_SET: "Laptop set",
  MONITOR: "Monitor",
  CHAIR: "Chair",
  PHONE: "Phone",
  KEYBOARD: "Keyboard",
  MOUSE: "Mouse",
  HEADSET: "Headset",
  SUPPLIES: "Supplies",
  OTHER: "Other",
}

const statusLabels: Record<RequestStatus, DtrAssetStatus[]> = {
  Pending: ["SUBMITTED"],
  Ongoing: ["SUPERVISOR_APPROVED"],
  Completed: ["ISSUED", "RETURNED"],
  Cancelled: ["SUPERVISOR_REJECTED", "CANCELLED"],
}

function dtrConfig() {
  const baseUrl = process.env.DTR_API_URL?.replace(/\/$/, "")
  const apiKey = process.env.DTR_INTERNAL_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error("DTR_API_URL and DTR_INTERNAL_API_KEY must be set.")
  }
  return { baseUrl, apiKey }
}

async function dtrFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = dtrConfig()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "x-internal-api-key": apiKey,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  })

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `DTR responded with ${response.status}.`
    throw new Error(message)
  }

  return data as T
}

function conditionLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function mapStatus(status: DtrAssetStatus): RequestStatus {
  const match = (Object.entries(statusLabels) as [RequestStatus, DtrAssetStatus[]][]).find(
    ([, values]) => values.includes(status),
  )
  return match?.[0] ?? "Pending"
}

function resolutionNote(row: DtrAssetRequest) {
  if (row.status === "SUBMITTED") return "Waiting for supervisor approval."
  if (row.status === "SUPERVISOR_REJECTED") {
    return row.supervisorNote?.trim() || "Denied by supervisor."
  }
  if (row.status === "CANCELLED") return "Cancelled by the employee."
  if (row.issued && row.status === "RETURNED") {
    const condition = row.issued.returnCondition
      ? ` (${conditionLabel(row.issued.returnCondition)})`
      : ""
    return `Returned${condition}. Serial ${row.issued.serialNumber}.`
  }
  if (row.issued) {
    return `Issued ${row.issued.serialNumber} (${conditionLabel(row.issued.conditionIssued)}).`
  }
  return row.supervisorNote?.trim() || null
}

export function dtrRequestToAssetRequest(row: DtrAssetRequest): AssetRequest {
  const status = mapStatus(row.status)
  const approved = status === "Ongoing" || status === "Completed"
  const assetType =
    row.assetType === "OTHER" && row.otherDetail?.trim()
      ? row.otherDetail.trim()
      : assetTypeLabels[row.assetType] ?? row.assetType
  const priority: RequestPriority = row.urgency === "URGENT" ? "Urgent" : "Normal"

  return {
    id: row.id,
    requestNo: 0,
    employeeId: row.employeeNo,
    requesterName: row.employeeName,
    department: row.department,
    assetType,
    quantity: row.quantity,
    reason: row.description,
    priority,
    status,
    neededBy: row.neededByDate,
    resolutionNote: resolutionNote(row),
    createdAt: row.createdAt,
    approvedAt: approved ? row.createdAt : null,
    completedAt: row.issued?.issuedAt ?? null,
    cancelledAt: status === "Cancelled" ? row.createdAt : null,
    source: "dtr",
    issuedAssetId: row.issued?.id ?? null,
    returned: row.status === "RETURNED",
  }
}

export async function listDtrAssetRequests(): Promise<AssetRequest[]> {
  const rows = await dtrFetch<DtrAssetRequest[]>(
    "/api/internal/assets/requests?status=ALL&limit=500",
  )
  return rows.map(dtrRequestToAssetRequest)
}

export async function issueDtrAssetRequest(
  id: string,
  input: { serialNumber: string; conditionIssued: DtrIssueCondition },
): Promise<AssetRequest> {
  const row = await dtrFetch<DtrAssetRequest>(
    `/api/internal/assets/requests/${encodeURIComponent(id)}/issue`,
    { method: "POST", body: JSON.stringify(input) },
  )
  return dtrRequestToAssetRequest(row)
}

export async function returnDtrAssetRequest(
  id: string,
  returnCondition: DtrReturnCondition,
): Promise<AssetRequest> {
  const current = await dtrFetch<DtrAssetRequest>(
    `/api/internal/assets/requests/${encodeURIComponent(id)}`,
  )
  if (!current.issued) {
    throw new Error("This request has not been issued yet.")
  }
  await dtrFetch(
    `/api/internal/assets/${encodeURIComponent(current.issued.id)}/return`,
    { method: "POST", body: JSON.stringify({ returnCondition }) },
  )
  const updated = await dtrFetch<DtrAssetRequest>(
    `/api/internal/assets/requests/${encodeURIComponent(id)}`,
  )
  return dtrRequestToAssetRequest(updated)
}
