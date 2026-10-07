import type {
  AssetRequest,
  RequestPriority,
  RequestStatus,
} from "@/lib/asset-requests"
import type {
  AssetRequestPriority,
  AssetRequestStatus,
  AssetRequest as AssetRequestRow,
} from "@/lib/generated/prisma"
import { fromIsoDate, toIsoDate } from "@/lib/inventory-map"
import { prisma } from "@/lib/prisma"

const statusFromDb: Record<AssetRequestStatus, RequestStatus> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  DENIED: "Denied",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
}

const statusToDb: Record<RequestStatus, AssetRequestStatus> = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Completed: "COMPLETED",
  Denied: "DENIED",
  Archived: "ARCHIVED",
  Deleted: "DELETED",
}

const priorityToDb: Record<RequestPriority, AssetRequestPriority> = {
  Low: "LOW",
  Normal: "NORMAL",
  High: "HIGH",
  Urgent: "URGENT",
}

const priorityFromDb = Object.fromEntries(
  Object.entries(priorityToDb).map(([label, value]) => [value, label]),
) as Record<AssetRequestPriority, RequestPriority>

function requestFromDb(row: AssetRequestRow): AssetRequest {
  return {
    id: row.id,
    requestNo: row.requestNo,
    employeeId: row.employeeId,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    department: row.department,
    assetType: row.assetType,
    quantity: row.quantity,
    reason: row.reason,
    priority: priorityFromDb[row.priority],
    status: statusFromDb[row.status],
    neededBy: row.neededBy ? toIsoDate(row.neededBy) : null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  }
}

function timestamp(value: string | null) {
  return value ? new Date(value) : null
}

function requestData(request: AssetRequest) {
  return {
    employeeId: request.employeeId || null,
    requesterName: request.requesterName.trim(),
    requesterEmail: request.requesterEmail?.trim() || null,
    department: request.department?.trim() || null,
    assetType: request.assetType.trim(),
    quantity: Math.max(1, Math.floor(request.quantity) || 1),
    reason: request.reason.trim(),
    priority: priorityToDb[request.priority] ?? "NORMAL",
    status: statusToDb[request.status] ?? "PENDING",
    neededBy: request.neededBy ? fromIsoDate(request.neededBy) : null,
    resolutionNote: request.resolutionNote?.trim() || null,
    approvedAt: timestamp(request.approvedAt),
    completedAt: timestamp(request.completedAt),
    cancelledAt: timestamp(request.cancelledAt),
  }
}

export async function listAssetRequests(): Promise<AssetRequest[]> {
  const rows = await prisma.assetRequest.findMany({
    orderBy: { requestNo: "desc" },
  })
  return rows.map(requestFromDb)
}

// Restoring a deleted request (undo) passes its old id, number and
// creation time back in so it comes back unchanged.
export async function createAssetRequest(
  request: AssetRequest,
): Promise<AssetRequest> {
  const restoring = request.requestNo > 0
  const row = await prisma.assetRequest.create({
    data: {
      ...requestData(request),
      ...(restoring && {
        id: request.id,
        requestNo: request.requestNo,
        createdAt: new Date(request.createdAt),
      }),
    },
  })
  return requestFromDb(row)
}

export async function getAssetRequest(id: string): Promise<AssetRequest | null> {
  const row = await prisma.assetRequest.findUnique({ where: { id } })
  return row ? requestFromDb(row) : null
}

export async function updateAssetRequest(
  request: AssetRequest,
): Promise<AssetRequest> {
  const row = await prisma.assetRequest.update({
    where: { id: request.id },
    data: requestData(request),
  })
  return requestFromDb(row)
}

export async function deleteAssetRequests(ids: string[]) {
  await prisma.assetRequest.deleteMany({ where: { id: { in: ids } } })
}

export type RequestOverride = {
  status: RequestStatus
  note: string | null
}

export async function listRequestOverrides(): Promise<Map<string, RequestOverride>> {
  const rows = await prisma.assetRequestOverride.findMany({
    select: { requestId: true, status: true, note: true },
  })
  return new Map(
    rows.map((row) => [
      row.requestId,
      { status: statusFromDb[row.status], note: row.note },
    ]),
  )
}

export async function saveRequestOverride(
  requestId: string,
  status: RequestStatus,
  note?: string | null,
) {
  await prisma.assetRequestOverride.upsert({
    where: { requestId },
    create: {
      requestId,
      status: statusToDb[status],
      note: note?.trim() || null,
    },
    update: {
      status: statusToDb[status],
      note: note?.trim() || null,
    },
  })
}

export async function clearRequestOverride(requestId: string) {
  await prisma.assetRequestOverride.deleteMany({ where: { requestId } })
}

export function applyRequestOverrides(
  requests: AssetRequest[],
  overrides: Map<string, RequestOverride>,
): AssetRequest[] {
  return requests.flatMap((request) => {
    const override = overrides.get(request.id)
    if (override?.status === "Deleted") return []
    if (!override) return [request]
    if (request.status === "Completed" && override.status !== "Archived") {
      return [request]
    }
    const approved =
      override.status === "Approved" ||
      override.status === "Completed" ||
      override.status === "Archived"
    return [
      {
        ...request,
        status: override.status,
        resolutionNote: override.note ?? request.resolutionNote,
        approvedAt: approved
          ? request.approvedAt ?? new Date().toISOString()
          : request.approvedAt,
        cancelledAt:
          override.status === "Denied"
            ? request.cancelledAt ?? new Date().toISOString()
            : request.cancelledAt,
      },
    ]
  })
}
