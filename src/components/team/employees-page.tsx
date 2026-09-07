"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Employee } from "@/lib/local-store/team-types";

// Phase 1: a real local employee roster/directory -- name, role, contact
// info, hire date. No pay rate, no paychecks, nothing payroll-shaped,
// since there's no Payroll behind this (out of scope, see
// QBO_FREE_FEATURES_PLAN.md). Matches the reference's "Tell us about your
// team" first-run screen until at least one employee exists.
export function EmployeesPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const employeesKey = activeCompany ? companyScopedKey(activeCompany.name, "employees") : null;
  const { items: employees, hydrated, add, update } = useLocalCollection<Employee>(employeesKey ?? "newgl:phase1:pending:employees");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hireDate, setHireDate] = useState("");

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "ACTIVE"), [employees]);

  function resetForm() {
    setName("");
    setJobTitle("");
    setEmail("");
    setPhone("");
    setHireDate("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setName(employee.name);
    setJobTitle(employee.jobTitle ?? "");
    setEmail(employee.email ?? "");
    setPhone(employee.phone ?? "");
    setHireDate(employee.hireDate ?? "");
    setShowForm(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      jobTitle: jobTitle.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      hireDate: hireDate || undefined
    };
    if (editingId) {
      update(editingId, patch);
      toast({ variant: "success", title: "Employee updated" });
    } else {
      add({ id: localId(), status: "ACTIVE", createdAt: new Date().toISOString(), ...patch });
      toast({ variant: "success", title: "Employee added" });
    }
    resetForm();
  }

  function handleMakeInactive(employee: Employee) {
    update(employee.id, { status: "ARCHIVED" });
    toast({ variant: "success", title: "Employee made inactive" });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (!hydrated) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (activeEmployees.length === 0 && !showForm) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
          <Users className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold text-[var(--color-text-global)]">Tell us about your team</p>
        <Button onClick={() => setShowForm(true)}>Add an employee</Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Employees</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add an employee"}</Button>
      </div>

      {showForm ? (
        <Card title={editingId ? "Edit employee" : "Add an employee"} description="Not backed by a server yet -- saved to this browser only." className="mb-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <InputField label="Name" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Job title (optional)" placeholder="e.g. Office Manager" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Hire date (optional)" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
            <Button type="submit" disabled={name.trim() === ""}>
              {editingId ? "Save changes" : "Add employee"}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Name</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Job title</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Email</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Phone</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Hire date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {activeEmployees.map((employee) => (
              <tr key={employee.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="p-2 align-top text-[13px]">
                  <button type="button" onClick={() => startEdit(employee)} className="font-medium text-[var(--color-text-global)] hover:underline">
                    {employee.name}
                  </button>
                </td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{employee.jobTitle || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{employee.email || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{employee.phone || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{employee.hireDate || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                  <button type="button" onClick={() => handleMakeInactive(employee)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                    Make inactive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
