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
import { ReserveFormSchema } from "@/schemas";

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
  const [errorBanner, setErrorBanner] = useState<{ title: string; detail: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; warehouseId?: string } | null>(null);

  const availableWarehouses =
    product?.warehouses.filter((w) => w.availableUnits > 0) ?? [];

  const handleClose = useCallback(() => {
    setSelectedWarehouse(null);
    setQuantity(1);
    setErrorBanner(null);
    setFieldErrors(null);
    onClose();
  }, [onClose]);

  const handleReserve = useCallback(async () => {
    if (!product || !selectedWarehouse) return;

    // ── Client-side Zod validation (shared schema with API) ──
    const parsed = ReserveFormSchema.safeParse({
      warehouseId: selectedWarehouse.warehouseId,
      quantity,
    });
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        quantity: errs.quantity?.[0],
        warehouseId: errs.warehouseId?.[0],
      });
      return;
    }
    setFieldErrors(null);
    // Also validate quantity doesn't exceed available stock client-side
    if (quantity > selectedWarehouse.availableUnits) {
      setFieldErrors({ quantity: `Only ${selectedWarehouse.availableUnits} unit(s) available here` });
      return;
    }

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
        const msg = `Only ${data.availableUnits ?? 0} unit(s) available at ${selectedWarehouse.warehouseName}. Someone else may have just reserved the last stock.`;
        // Inline banner (persistent, inside the modal)
        setErrorBanner({
          title: "Not enough stock",
          detail: msg,
        });
        // Toast as well for accessibility
        toast.error("Not enough stock! 😓", {
          description: msg,
          duration: 5000,
        });
        onSuccess(); // Refresh stock counts behind the modal
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
      <DialogContent className="glass-strong border-white/10 rounded-2xl max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* ── Fixed header ─────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold gradient-text">
              Reserve Stock
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Hold units for 10 minutes while you complete payment.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Product summary */}
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.4 0.15 270), oklch(0.3 0.1 290))",
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
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
              )}
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
                  onClick={() => {
                    setQuantity((q) => Math.min(selectedWarehouse.availableUnits, q + 1));
                    setFieldErrors(null);
                  }}
                  disabled={quantity >= selectedWarehouse.availableUnits}
                  className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-lg font-medium hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  +
                </button>
              </div>
              {/* Zod field error — shown inline beneath the stepper */}
              {fieldErrors?.quantity && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium flex items-center gap-1.5 animate-in fade-in duration-200"
                  style={{ color: "oklch(0.72 0.22 15)" }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {fieldErrors.quantity}
                </p>
              )}
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

          {/* ── 409 Error banner (visible, persistent) ── */}
          {errorBanner && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl p-4 border text-sm animate-in fade-in slide-in-from-top-2 duration-300"
              style={{
                background: "oklch(0.25 0.08 15 / 0.6)",
                borderColor: "oklch(0.55 0.2 15 / 0.5)",
              }}
            >
              {/* Icon */}
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.7 0.22 15)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: "oklch(0.8 0.18 15)" }}>
                  {errorBanner.title}
                </p>
                <p className="mt-0.5 leading-relaxed" style={{ color: "oklch(0.65 0.12 15)" }}>
                  {errorBanner.detail}
                </p>
              </div>
              <button
                aria-label="Dismiss error"
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => setErrorBanner(null)}
                style={{ color: "oklch(0.7 0.22 15)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

        </div>
        {/* ── Fixed footer (always visible) ────────────────── */}
        <div className="px-6 py-4 border-t border-white/5 flex-shrink-0 flex gap-3">
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
      </DialogContent>
    </Dialog>
  );
}
