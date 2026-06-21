import type { ServiceContainer } from "@/modules/accounting/application/contracts";
import { createHttpServiceContainer } from "@/lib/services/http-service-container";

export function getServiceContainer(): ServiceContainer {
  return createHttpServiceContainer();
}
