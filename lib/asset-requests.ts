// IT asset requests: Pending → Approved or Denied → Completed, then Archive.
export const requestStatuses = [
  "Pending",
  "Approved",
  "Completed",
  "Denied",
  "Archived",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const openRequestStatuses: RequestStatus[] = ["Pending", "Approved"];
export const archiveableStatuses: RequestStatus[] = ["Completed", "Denied"];

export const requestPriorities = ["Low", "Normal", "High", "Urgent"] as const;
export type RequestPriority = (typeof requestPriorities)[number];

export const requestAssetTypes = [
  "Laptop",
  "Headset",
  "Mouse",
  "Keyboard",
  "Monitor",
  "Laptop bag",
  "Battery",
  "RAM",
  "Charger",
  "Peripheral kit",
  "Hardware device",
  "Phone",
  "Other",
];

export type AssetRequest = {
  id: string;
  requestNo: number;
  employeeId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  department: string | null;
  assetType: string;
  quantity: number;
  reason: string;
  priority: RequestPriority;
  status: RequestStatus;
  // yyyy-mm-dd
  neededBy: string | null;
  resolutionNote: string | null;
  // ISO timestamps
  createdAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  // Set when the request was filed in DTR. Local requests leave this unset.
  source?: "dtr";
  issuedAssetId?: string | null;
  returned?: boolean;
};

export function previousStatusAfterUnarchive(
  request: Pick<AssetRequest, "completedAt" | "cancelledAt" | "approvedAt">,
): RequestStatus {
  if (request.completedAt) return "Completed";
  if (request.cancelledAt) return "Denied";
  if (request.approvedAt) return "Approved";
  return "Pending";
}

export function requestCode(
  request: Pick<AssetRequest, "requestNo"> &
    Partial<Pick<AssetRequest, "source" | "id">>,
) {
  if (request.source === "dtr" && request.id) {
    return `DTR-${request.id.slice(-6).toUpperCase()}`;
  }
  return `REQ-${String(request.requestNo).padStart(4, "0")}`;
}

export const requestStatusStyles: Record<
  RequestStatus,
  { dot: string; text: string }
> = {
  Pending: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  Approved: { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  Completed: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  Denied: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  Archived: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
};

export const priorityStyles: Record<RequestPriority, string> = {
  Low: "bg-muted text-muted-foreground",
  Normal: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  High: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Urgent: "bg-red-500/10 text-red-700 dark:text-red-400",
};
