"use client";

import { useState } from "react";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { RecurringMode, RecurringSchedule, RecurringTemplate } from "@/lib/services/recurring-service";

const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const MODE_OPTIONS = [{ value: "SCHEDULED", label: "Scheduled" }, { value: "REMINDER", label: "Reminder" }, { value: "UNSCHEDULED", label: "Unscheduled" }];
const UNIT_OPTIONS = [{ value: "DAY", label: "Daily" }, { value: "WEEK", label: "Weekly" }, { value: "MONTH", label: "Monthly" }, { value: "YEAR", label: "Yearly" }];
const END_OPTIONS = [{ value: "NONE", label: "None" }, { value: "BY", label: "By" }, { value: "AFTER", label: "After" }];
const WEEKDAY_OPTIONS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, i) => ({ value: String(i), label }));
const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((label, i) => ({ value: String(i + 1), label }));
const ordinalDay = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const DAY_OPTIONS = [...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: ordinalDay(i + 1) })), { value: "-1", label: "last" }];

export type RecurringTemplateState = ReturnType<typeof useRecurringTemplate>;

/**
 * State for QBO's "Make recurring" mode, shared by every form that offers it
 * (Expense, Check, Deposit, Journal Entry): `active` swaps the form's header
 * for the template fields below, and `buildBody` turns them into the API input.
 */
export function useRecurringTemplate() {
  const [active, setActive] = useState(false);
  const [id, setId] = useState<string | null>(null); // template being edited
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RecurringMode>("SCHEDULED");
  const [advance, setAdvance] = useState("");
  const [unit, setUnit] = useState<RecurringSchedule["unit"]>("MONTH");
  const [every, setEvery] = useState("1");
  const [onDay, setOnDay] = useState("1");
  const [onWeekday, setOnWeekday] = useState("1");
  const [onMonth, setOnMonth] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endType, setEndType] = useState<RecurringSchedule["endType"]>("NONE");
  const [endDate, setEndDate] = useState("");
  const [endAfter, setEndAfter] = useState("");

  /** Open as the template editor for `t` (the list's "Edit"). */
  function load(t: RecurringTemplate) {
    setActive(true);
    setId(t.id);
    setName(t.name);
    setMode(t.mode);
    setAdvance(t.daysInAdvance ? String(t.daysInAdvance) : "");
    if (!t.schedule) return;
    setUnit(t.schedule.unit);
    setEvery(String(t.schedule.every));
    setOnDay(String(t.schedule.onDay ?? 1));
    setOnWeekday(String(t.schedule.onWeekday ?? 1));
    setOnMonth(String(t.schedule.onMonth ?? 1));
    setStartDate(t.schedule.startDate);
    setEndType(t.schedule.endType);
    setEndDate(t.schedule.endDate ?? "");
    setEndAfter(t.schedule.endAfter ? String(t.schedule.endAfter) : "");
  }
  function start(defaultStart: string) {
    setActive(true);
    setStartDate((d) => d || defaultStart);
  }
  function cancel() {
    setActive(false);
    setId(null);
  }

  /** The name/mode/schedule part of the API input, or the message to show. */
  function buildBody(): { error: string } | { name: string; mode: RecurringMode; daysInAdvance: number; schedule?: RecurringSchedule } {
    if (!name.trim()) return { error: "Enter a template name." };
    let schedule: RecurringSchedule | undefined;
    if (mode !== "UNSCHEDULED") {
      if (!startDate) return { error: "Enter a start date." };
      if (!(Number(every) >= 1)) return { error: "The interval must be at least 1." };
      if (endType === "BY" && !endDate) return { error: "Enter the end date." };
      if (endType === "AFTER" && !(Number(endAfter) >= 1)) return { error: "Enter how many occurrences." };
      schedule = {
        unit,
        every: Math.floor(Number(every)),
        onDay: unit === "MONTH" || unit === "YEAR" ? Number(onDay) : undefined,
        onWeekday: unit === "WEEK" ? Number(onWeekday) : undefined,
        onMonth: unit === "YEAR" ? Number(onMonth) : undefined,
        startDate,
        endType,
        endDate: endType === "BY" ? endDate : undefined,
        endAfter: endType === "AFTER" ? Math.floor(Number(endAfter)) : undefined
      };
    }
    return { name: name.trim(), mode, daysInAdvance: mode === "SCHEDULED" ? Math.max(0, Math.floor(Number(advance) || 0)) : 0, schedule };
  }

  return { active, id, setId, name, setName, mode, setMode, advance, setAdvance, unit, setUnit, every, setEvery, onDay, setOnDay, onWeekday, setOnWeekday, onMonth, setOnMonth, startDate, setStartDate, endType, setEndType, endDate, setEndDate, endAfter, setEndAfter, load, start, cancel, buildBody };
}

/** Template name, Type and "Create N days in advance". */
export function RecurringNameRow({ tpl }: { tpl: RecurringTemplateState }) {
  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-[var(--color-divider-tertiary)] pb-5">
      <div className="w-[220px]">
        <label className={LABEL} htmlFor="tpl-name">Template name</label>
        <InputField id="tpl-name" value={tpl.name} onChange={(event) => tpl.setName(event.target.value)} autoFocus />
      </div>
      <div className="w-[220px]">
        <span className={LABEL}>Type</span>
        <Select value={tpl.mode} onChange={(v) => tpl.setMode(v as RecurringMode)} options={MODE_OPTIONS} placeholder="" allowCustomValue={false} />
      </div>
      {tpl.mode === "SCHEDULED" ? (
        <div className="flex items-center gap-3 pb-2">
          <span>Create</span>
          <InputField aria-label="Days in advance" type="number" min="0" value={tpl.advance} onChange={(event) => tpl.setAdvance(event.target.value)} className="w-[80px]" />
          <span>days in advance</span>
        </div>
      ) : null}
    </div>
  );
}

/** Interval, Start date and End. Renders nothing for an Unscheduled template. */
export function RecurringIntervalRow({ tpl }: { tpl: RecurringTemplateState }) {
  if (tpl.mode === "UNSCHEDULED") return null;
  const { unit } = tpl;
  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-[var(--color-divider-tertiary)] py-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[150px]">
          <span className={LABEL}>Interval</span>
          <Select value={unit} onChange={(v) => tpl.setUnit(v as RecurringSchedule["unit"])} options={UNIT_OPTIONS} placeholder="" allowCustomValue={false} />
        </div>
        {unit === "WEEK" ? (
          <>
            <span className="pb-2">on</span>
            <div className="w-[160px]"><Select value={tpl.onWeekday} onChange={tpl.setOnWeekday} options={WEEKDAY_OPTIONS} placeholder="" allowCustomValue={false} /></div>
          </>
        ) : null}
        {unit === "YEAR" ? (
          <>
            <span className="pb-2">on</span>
            <div className="w-[150px]"><Select value={tpl.onMonth} onChange={tpl.setOnMonth} options={MONTH_OPTIONS} placeholder="" allowCustomValue={false} /></div>
          </>
        ) : null}
        {unit === "MONTH" || unit === "YEAR" ? (
          <>
            {unit === "MONTH" ? <span className="pb-2">on day</span> : null}
            <div className="w-[110px]"><Select value={tpl.onDay} onChange={tpl.setOnDay} options={DAY_OPTIONS} placeholder="" allowCustomValue={false} /></div>
          </>
        ) : null}
        <span className="pb-2">{unit === "DAY" ? "every" : "of every"}</span>
        <InputField aria-label="Repeat every" type="number" min="1" value={tpl.every} onChange={(event) => tpl.setEvery(event.target.value)} className="w-[80px]" />
        <span className="pb-2">{{ DAY: "day(s)", WEEK: "week(s)", MONTH: "month(s)", YEAR: "year(s)" }[unit]}</span>
      </div>
      <div>
        <label className={LABEL} htmlFor="tpl-start">Start date</label>
        <InputField id="tpl-start" type="date" value={tpl.startDate} onChange={(event) => tpl.setStartDate(event.target.value)} className="w-[200px]" />
      </div>
      <div className="flex items-end gap-3">
        <div className="w-[130px]">
          <span className={LABEL}>End</span>
          <Select value={tpl.endType} onChange={(v) => tpl.setEndType(v as RecurringSchedule["endType"])} options={END_OPTIONS} placeholder="" allowCustomValue={false} />
        </div>
        {tpl.endType === "BY" ? <InputField aria-label="End date" type="date" value={tpl.endDate} onChange={(event) => tpl.setEndDate(event.target.value)} className="w-[180px]" /> : null}
        {tpl.endType === "AFTER" ? (
          <>
            <InputField aria-label="Occurrences" type="number" min="1" value={tpl.endAfter} onChange={(event) => tpl.setEndAfter(event.target.value)} className="w-[90px]" />
            <span className="pb-2">occurrences</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
