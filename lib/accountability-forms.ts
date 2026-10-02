import type { EquipmentRow } from "@/lib/pdf/fill-accountability-form";

// Shared (client + server) shapes for the Accountability page.
export type FormSend = {
  id: string;
  toEmail: string;
  sentByName: string | null;
  sentAt: string;
};

export type FormVersion = {
  id: string;
  holderName: string;
  version: number;
  hrName: string;
  itOfficerName: string;
  generatedOn: string;
  itemCount: number;
  createdByName: string | null;
  createdAt: string;
  sends: FormSend[];
};

export const formStates = ["Up to date", "Needs update", "No form"] as const;
export type FormState = (typeof formStates)[number];

// One person currently holding equipment.
export type AccountabilityRow = {
  holderName: string;
  employeeId: string | null;
  department: string | null;
  // From HRIS, for "Send copy".
  email: string | null;
  assets: { label: string; count: number }[];
  itemCount: number;
  latest: FormVersion | null;
  versionCount: number;
  state: FormState;
};

export const formStateStyles: Record<FormState, { dot: string; text: string }> =
  {
    "Up to date": {
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    "Needs update": {
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    },
    "No form": { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  };

export function formPdfUrl(formId: string, download = false) {
  return `/api/accountability-forms/${formId}/pdf${download ? "?download=1" : ""}`;
}

// Everything needed to put deleted form versions back exactly (Undo).
export type FormBackup = {
  id: string;
  holderName: string;
  employeeId: string | null;
  department: string | null;
  version: number;
  hrName: string;
  itOfficerName: string;
  generatedOn: string;
  equipment: EquipmentRow[];
  signature: string;
  createdByName: string | null;
  createdAt: string;
  sends: { id: string; toEmail: string; sentByName: string | null; sentAt: string }[];
  // Present only on backups the server just issued, so Undo can prove it.
  token?: string;
};
