import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Products & Services catalog for the caller's CURRENTLY ACTIVE company
// (see newgl-api's products-services.ts). Phase 1.5, Step 6.
export type ProductServiceType = "SERVICE" | "PRODUCT";

export type ProductOrService = {
  id: string;
  name: string;
  type: ProductServiceType;
  description?: string;
  salesPrice?: number;
  incomeAccountId?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type CreateProductInput = {
  name: string;
  type: ProductServiceType;
  description?: string;
  salesPrice?: number;
  incomeAccountId?: string;
};

export type UpdateProductInput = Partial<CreateProductInput> & { status?: "ACTIVE" | "ARCHIVED" };

export function listProductsServices(): Promise<ProductOrService[]> {
  return request<ProductOrService[]>(BASE_API_URL, "/products-services");
}

export function createProductOrService(input: CreateProductInput): Promise<ProductOrService> {
  return request<ProductOrService>(BASE_API_URL, "/products-services", { method: "POST", body: JSON.stringify(input) });
}

export function updateProductOrService(productId: string, patch: UpdateProductInput): Promise<ProductOrService> {
  return request<ProductOrService>(BASE_API_URL, `/products-services/${productId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteProductOrService(productId: string): Promise<void> {
  await request(BASE_API_URL, `/products-services/${productId}`, { method: "DELETE" });
}
