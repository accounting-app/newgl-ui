import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Mileage trip log for the caller's CURRENTLY ACTIVE company (see
// newgl-api's mileage.ts). Phase 1.5, Step 2.
export type MileageTripType = "BUSINESS" | "PERSONAL";

export type MileageEntry = {
  id: string;
  date: string;
  miles: number;
  ratePerMile: number;
  type: MileageTripType;
  startAddress?: string;
  endAddress?: string;
  purpose?: string;
  createdAt: string;
};

export type CreateMileageEntryInput = {
  date: string;
  miles: number;
  ratePerMile: number;
  type: MileageTripType;
  startAddress?: string;
  endAddress?: string;
  purpose?: string;
};

export function listMileageEntries(): Promise<MileageEntry[]> {
  return request<MileageEntry[]>(BASE_API_URL, "/mileage-entries");
}

export function createMileageEntry(input: CreateMileageEntryInput): Promise<MileageEntry> {
  return request<MileageEntry>(BASE_API_URL, "/mileage-entries", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteMileageEntry(entryId: string): Promise<void> {
  await request(BASE_API_URL, `/mileage-entries/${entryId}`, { method: "DELETE" });
}
