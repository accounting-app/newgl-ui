import type { ServiceContainer } from "@/modules/accounting/application/contracts";
import { createMockAccountingServices } from "@/modules/accounting/mocks/mock-services-v2";
import { clearAccountingStore } from "@/shared/storage/accounting-store-persistence";

let container: ServiceContainer | null = null;

export function getServiceContainer(): ServiceContainer {
  if (!container) {
    container = createMockAccountingServices();
  }
  return container;
}

export function resetServiceContainer(): void {
  clearAccountingStore();
  container = null;
}
