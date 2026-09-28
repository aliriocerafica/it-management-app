import { prisma } from "@/lib/prisma"

export const ACCOUNTABILITY_SETTINGS_ID = "default"
export const DEFAULT_HR_NAME = "CAMILLE TUIBEO"
export const DEFAULT_IT_OFFICER_NAME = ""

export type AccountabilityFormSettings = {
  hrName: string
  itOfficerName: string
}

export async function getAccountabilityFormSettings(): Promise<AccountabilityFormSettings> {
  const row = await prisma.accountabilityFormSettings.findUnique({
    where: { id: ACCOUNTABILITY_SETTINGS_ID },
  })
  return {
    hrName: row?.hrName.trim() || DEFAULT_HR_NAME,
    itOfficerName: row?.itOfficerName.trim() || DEFAULT_IT_OFFICER_NAME,
  }
}

export async function saveAccountabilityFormSettings(
  input: AccountabilityFormSettings,
): Promise<AccountabilityFormSettings> {
  const row = await prisma.accountabilityFormSettings.upsert({
    where: { id: ACCOUNTABILITY_SETTINGS_ID },
    create: {
      id: ACCOUNTABILITY_SETTINGS_ID,
      hrName: input.hrName,
      itOfficerName: input.itOfficerName,
    },
    update: {
      hrName: input.hrName,
      itOfficerName: input.itOfficerName,
    },
  })
  return { hrName: row.hrName, itOfficerName: row.itOfficerName }
}
