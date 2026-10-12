"use client";

import { useState } from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";

import { FormField, selectClass } from "@/components/add-laptop-dialog";
import { EmployeePickerDialog } from "@/components/employee-picker-dialog";
import { FormSelect } from "@/components/form-select";
import { Input } from "@/components/ui/input";
import { type LaptopStatus } from "@/lib/laptops";
import { cn } from "@/lib/utils";

// Status, handler and department on the "Add" forms. The handler is chosen
// in the employee picker; the form reads all three from FormData by name.
export function AssignmentFields({
  statuses,
  holders,
  noun,
  showHandler = true,
}: {
  statuses: readonly LaptopStatus[];
  // Existing items of this type, to show who already holds one.
  holders: { handler: string | null; assetTag: string }[];
  noun: string;
  showHandler?: boolean;
}) {
  const [status, setStatus] = useState<LaptopStatus>("Vacant");
  const [handler, setHandler] = useState("");
  const [department, setDepartment] = useState("");
  const [picking, setPicking] = useState(false);

  return (
    <>
      <FormField label="Status" htmlFor="status">
        <FormSelect
          id="status"
          name="status"
          value={status}
          onChange={(value) => setStatus(value as LaptopStatus)}
          options={statuses.map((option) => ({ value: option, label: option }))}
        />
      </FormField>
      {showHandler && (
        <>
          <FormField label="Handler" htmlFor="handler" optional>
            <div className="relative">
              <button
                id="handler"
                type="button"
                aria-haspopup="dialog"
                className={cn(
                  selectClass,
                  "flex items-center justify-between gap-2 text-left",
                  handler && "pr-8",
                )}
                onClick={() => setPicking(true)}
              >
                <span
                  className={cn(
                    "truncate",
                    !handler && "text-muted-foreground",
                  )}
                >
                  {handler || "Select employee"}
                </span>
                {!handler && (
                  <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
              {handler && (
                <button
                  type="button"
                  aria-label="Clear handler"
                  className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => {
                    setHandler("");
                    setDepartment("");
                    if (status === "In use") setStatus("Vacant");
                  }}
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
            <input type="hidden" name="handler" value={handler} />
          </FormField>
          <FormField label="Department" htmlFor="department" optional>
            <Input
              id="department"
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g. Engineering"
            />
          </FormField>
          <EmployeePickerDialog
            open={picking}
            onOpenChange={setPicking}
            holders={holders}
            noun={noun}
            onPick={(employee) => {
              setHandler(employee.name);
              setDepartment(employee.department);
              // A vacant item can't have a handler, so picking one assigns it.
              if (status === "Vacant") setStatus("In use");
              setPicking(false);
            }}
          />
        </>
      )}
    </>
  );
}
