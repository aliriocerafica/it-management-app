"use client";

import { useEffect, useState } from "react";

import type { Employee } from "@/lib/employees";

// HRIS employee directory, loaded when the component using it mounts
// (e.g. a dialog opening). The server caches the HRIS feed.
export function useEmployeeDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/employees")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Employee[]>;
      })
      .then((list) => {
        if (cancelled) return;
        setEmployees(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, status };
}
