// Phase-1 local-only shapes for the Team domain -- same convention as
// expenses-bills-types.ts/sales-types.ts. "Employees" here is a plain
// roster/directory (name, role, contact info) -- there's no Payroll
// behind it (out of scope, see QBO_FREE_FEATURES_PLAN.md), so there's no
// pay rate, no paychecks, nothing payroll-shaped. Workers' comp is a real
// insurance product, same reasoning as excluding Lending/Business Tax --
// not modeled here at all.

export type Employee = {
  id: string;
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};
