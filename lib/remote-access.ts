import type { Employee } from "@/lib/employees"
import type { Laptop } from "@/lib/laptops"

export type RemoteAccessRow = {
  employee: Employee
  laptops: Laptop[]
}
