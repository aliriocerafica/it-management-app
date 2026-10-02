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
  APPROVED: "Ongoing",
  COMPLETED: "Completed",
  DENIED: "Cancelled",
}

const statusToDb: Record<RequestStatus, AssetRequestStatus> = {
  Pending: "PENDING",
  Ongoing: "APPROVED",
  Completed: "COMPLETED",
  Cancelled: "DENIED",
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
