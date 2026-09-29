// Stand-in until the other system's employee API is wired up.
// Inventory tables store `employeeId` only — no employee table in this database.
export type Employee = {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
};

export const employees: Employee[] = [];
