import { z } from "zod";

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/**
 * Client-side form schema — derived from the API schema so validation rules
 * are defined once and shared between the API route and the Reserve modal form.
 *
 * warehouseId is validated as non-empty (user must select a warehouse).
 * quantity is validated client-side before the API call is even made.
 */
export const ReserveFormSchema = CreateReservationSchema.pick({
  warehouseId: true,
  quantity: true,
}).extend({
  // Quantity is additionally bounded by available stock — checked at runtime
  quantity: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 unit")
    .max(100, "Maximum 100 units per reservation"),
});

export type ReserveFormInput = z.infer<typeof ReserveFormSchema>;

// ─── Response Types ───────────────────────────────────────────────────────────

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

export interface ProductWithStock {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: string;
  imageUrl: string | null;
  warehouses: WarehouseStock[];
}

export interface ReservationDetail {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productPrice: string;
  productImageUrl: string | null;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  quantity: number;
  status: "pending" | "confirmed" | "released";
  expiresAt: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
