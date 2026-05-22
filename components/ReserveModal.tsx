"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProductWithStock, WarehouseStock, ReservationDetail } from "@/schemas";

interface ReserveModalProps {
  product: ProductWithStock | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReserveModal({
  product,
  open,
  onClose,
  onSuccess,
}: ReserveModalProps) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseStock | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const availableWarehouses =
    product?.warehouses.filter((w) => w.availableUnits > 0) ?? [];

  const handleClose = useCallback(() => {
    setSelectedWarehouse(null);
    setQuantity(1);
    onClose();
  }, [onClose]);

  const handleReserve = useCallback(async () => {
    if (!product || !selectedWarehouse) return;

    setLoading(true);

    try {
      // Generate idempotency key for this attempt
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse.warehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Not enough stock! 😓", {
          description: `Only ${data.availableUnits} unit(s) available at ${selectedWarehouse.warehouseName}.`,
          duration: 5000,
        });
        onSuccess(); // Refresh stock display
        return;
      }

      if (!res.ok) {
        toast.error("Reservation failed", {
          description: data.error || "Please try again.",
        });
        return;
      }

      const reservation = data as ReservationDetail;
      toast.success("Reserved! 🎉", {
        description: `${quantity}× ${product.name} held for 10 minutes.`,
      });
      handleClose();
      onSuccess(); // Refresh product stock
      router.push(`/reservations/${reservation.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [product, selectedWarehouse, quantity, handleClose, onSuccess, router]);

  if (!product) return null;

  const price = parseFloat(product.price);
  const formattedTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price * quantity);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="glass-strong border-white/10 rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold gradient-text">
            Reserve Stock
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Hold units for 10 minutes while you complete payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Product summary */}
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.4 0.15 270), oklch(0.3 0.1 290))",
              }}
            >
              <svg
                className="w-6 h-6 text-white/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{product.name}</p>
              <p className="text-muted-foreground text-xs font-mono">{product.sku}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-bold gradient-text">
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(price)}
              </p>
              <p className="text-muted-foreground text-xs">per unit</p>
            </div>
          </div>

          {/* Warehouse selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Select Warehouse
            </label>
            <div className="space-y-2">
              {availableWarehouses.map((wh) => {
                const isSelected = selectedWarehouse?.warehouseId === wh.warehouseId;
                const isLow = wh.availableUnits <= 3;
                return (
                  <button
                    key={wh.warehouseId}
                    id={`warehouse-${wh.warehouseId}`}
                    type="button"
                    onClick={() => {
                      setSelectedWarehouse(wh);
                      setQuantity(Math.min(quantity, wh.availableUnits));
                    }}
                    className={`w-full rounded-xl p-3 text-left transition-all duration-150 border ${
                      isSelected
                        ? "border-primary/60 bg-primary/10 glow-primary"
                        : "border-white/5 bg-white/3 hover:border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{wh.warehouseName}</p>
                          <p className="text-xs text-muted-foreground">{wh.warehouseLocation}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            isLow
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-green-500/20 text-green-400 border-green-500/30"
                          }`}
                        >
                          {wh.availableUnits} available
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}

              {availableWarehouses.length === 0 && (
                <div className="glass rounded-xl p-4 text-center text-sm text-muted-foreground">
                  No stock available across all warehouses.
                </div>
              )}
            </div>
          </div>

          {/* Quantity */}
          {selectedWarehouse && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  id="qty-decrease"
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-lg font-medium hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold">{quantity}</span>
                  <p className="text-xs text-muted-foreground">
                    of {selectedWarehouse.availableUnits} available
                  </p>
                </div>
                <button
                  id="qty-increase"
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(selectedWarehouse.availableUnits, q + 1))
                  }
                  disabled={quantity >= selectedWarehouse.availableUnits}
                  className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-lg font-medium hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Hold info banner */}
          <div className="flex items-start gap-2.5 rounded-xl p-3 bg-primary/10 border border-primary/20 text-sm">
            <svg
              className="w-4 h-4 text-primary mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-primary/80">
              Stock will be held for <strong>10 minutes</strong>. If you
              don&apos;t complete payment, it&apos;s automatically released.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              id="cancel-reserve"
              variant="outline"
              className="flex-1 rounded-xl border-white/10 hover:bg-white/5"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              id="confirm-reserve"
              className="flex-1 rounded-xl font-semibold"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.6 0.2 290))",
                boxShadow: "0 4px 20px oklch(0.65 0.22 270 / 0.3)",
              }}
              disabled={!selectedWarehouse || loading}
              onClick={handleReserve}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Reserving…
                </span>
              ) : (
                <>
                  Reserve{" "}
                  {selectedWarehouse ? (
                    <span className="ml-1 opacity-80">{formattedTotal}</span>
                  ) : null}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
