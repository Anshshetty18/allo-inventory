import { z } from "zod";

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

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
