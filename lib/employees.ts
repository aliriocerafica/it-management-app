// Stand-in until the other system's employee API is wired up.
// Inventory tables store `employeeId` only — no employee table in this database.
export type Employee = {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
};

export const employees: Employee[] = [
  {
    id: "e1",
    name: "Liam Smith",
    department: "Management",
    title: "Project Manager",
    email: "liam.smith@example.com",
  },
  {
    id: "e2",
    name: "Noah Anderson",
    department: "Design",
    title: "UX Designer",
    email: "noah.anderson@example.com",
  },
  {
    id: "e3",
    name: "Isabella Garcia",
    department: "Engineering",
    title: "Front-End Developer",
    email: "isabella.garcia@example.com",
  },
  {
    id: "e4",
    name: "William Clark",
    department: "Product",
    title: "Product Owner",
    email: "william.clark@example.com",
  },
  {
    id: "e5",
    name: "James Hall",
    department: "Operations",
    title: "Business Analyst",
    email: "james.hall@example.com",
  },
  {
    id: "e6",
    name: "Benjamin Lewis",
    department: "Data",
    title: "Data Analyst",
    email: "benjamin.lewis@example.com",
  },
  {
    id: "e7",
    name: "Amelia Davis",
    department: "Design",
    title: "UX Designer",
    email: "amelia.davis@example.com",
  },
  {
    id: "e8",
    name: "Emma Johnson",
    department: "Design",
    title: "UX Designer",
    email: "emma.johnson@example.com",
  },
  {
    id: "e9",
    name: "Olivia Brown",
    department: "Marketing",
    title: "Marketing Specialist",
    email: "olivia.brown@example.com",
  },
  {
    id: "e10",
    name: "Ava Williams",
    department: "Engineering",
    title: "Software Engineer",
    email: "ava.williams@example.com",
  },
  {
    id: "e11",
    name: "Sophia Jones",
    department: "Engineering",
    title: "Front-End Developer",
    email: "sophia.jones@example.com",
  },
  {
    id: "e12",
    name: "Mia Miller",
    department: "Security",
    title: "Security Analyst",
    email: "mia.miller@example.com",
  },
  {
    id: "e13",
    name: "Lucas Young",
    department: "Engineering",
    title: "Front-End Developer",
    email: "lucas.young@example.com",
  },
  {
    id: "e14",
    name: "Alexander Wright",
    department: "IT",
    title: "DevOps Engineer",
    email: "alexander.wright@example.com",
  },
  {
    id: "e15",
    name: "Harper Martinez",
    department: "IT",
    title: "System Architect",
    email: "harper.martinez@example.com",
  },
  {
    id: "e16",
    name: "Charlotte Reed",
    department: "Marketing",
    title: "Content Strategist",
    email: "charlotte.reed@example.com",
  },
  {
    id: "e17",
    name: "Ethan Brooks",
    department: "Sales",
    title: "Account Executive",
    email: "ethan.brooks@example.com",
  },
  {
    id: "e18",
    name: "Chloe Ramirez",
    department: "Finance",
    title: "Accountant",
    email: "chloe.ramirez@example.com",
  },
  {
    id: "e19",
    name: "Daniel Foster",
    department: "Support",
    title: "Support Specialist",
    email: "daniel.foster@example.com",
  },
  {
    id: "e20",
    name: "Zoe Bennett",
    department: "HR",
    title: "HR Coordinator",
    email: "zoe.bennett@example.com",
  },
  {
    id: "e21",
    name: "Ryan Cooper",
    department: "Engineering",
    title: "Back-End Developer",
    email: "ryan.cooper@example.com",
  },
  {
    id: "e22",
    name: "Lily Chen",
    department: "Sales",
    title: "Sales Development Rep",
    email: "lily.chen@example.com",
  },
];
