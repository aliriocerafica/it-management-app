// Employees come from the HRIS directory (see lib/hris.ts, /api/employees).
// Inventory tables store `employeeId` only — no employee table in this database.
export type Employee = {
  id: string;
  name: string;
  department: string;
  departmentCode?: string;
  title: string;
  email: string;
};

// Server-side lookups by name still read this until they're moved to HRIS.
export const employees: Employee[] = [];
