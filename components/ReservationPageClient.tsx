"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { ReservationDetail } from "@/schemas";

interface ReservationPageClientProps {
  id: string;
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: {
      label: "Pending",
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    confirmed: {
      label: "Confirmed",
      className: "bg-green-500/20 text-green-400 border-green-500/30 glow-success",
    },
    released: {
      label: "Released",
      className: "bg-muted text-muted-foreground border-muted",
    },
  };
  const s = config[status as keyof typeof config] ?? config.pending;
  return (
    <Badge variant="outline" className={`text-sm px-3 py-1 font-medium ${s.className}`}>
      <span className="w-2 h-2 rounded-full mr-2 inline-block bg-current opacity-70" />
      {s.label}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function ReservationPageClient({ id }: ReservationPageClientProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [errorBanner, setErrorBanner] = useState<{
    code: "409" | "410";
    title: string;
    detail: string;
  } | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      // We'll fetch via confirm to get data — or build a GET endpoint
      // Instead, we'll rely on the data returned from the POST that created it,
      // which we stored via router navigation. Re-fetch via a lightweight approach:
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Reservation not found");
        return;
      }
      const data: ReservationDetail = await res.json();
      setReservation(data);

      // Check if already expired on load
      if (data.status === "pending" && new Date(data.expiresAt) < new Date()) {
        setExpired(true);
      }
    } catch {
      setError("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleConfirm = useCallback(async () => {
    if (!reservation) return;
    setActionLoading("confirm");

    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const data = await res.json();

      if (res.status === 410) {
        const msg = data.error ?? "Reservation has expired.";
        // Prominent inline banner
        setErrorBanner({
          code: "410",
          title: "Reservation Expired",
          detail: msg + " Your reserved stock has been returned to the warehouse.",
        });
        // Toast too
        toast.error("Reservation expired 😣", { description: msg, duration: 6000 });
        setExpired(true);
        setReservation((prev) => prev ? { ...prev, status: "released" } : prev);
        return;
      }

      if (res.status === 409) {
        const msg = data.error ?? "Cannot confirm this reservation.";
        setErrorBanner({
          code: "409",
          title: "Cannot Confirm",
          detail: msg,
        });
        toast.error("Cannot confirm", { description: msg });
        return;
      }

      if (!res.ok) {
        toast.error("Confirmation failed", { description: data.error });
        return;
      }

      const confirmed: ReservationDetail = data;
      setReservation(confirmed);
      toast.success("Purchase confirmed! 🎉", {
        description: `${confirmed.quantity}× ${confirmed.productName} — thank you!`,
        duration: 8000,
      });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }, [id, reservation]);

  const handleCancel = useCallback(async () => {
    if (!reservation) return;
    setActionLoading("cancel");

    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error("Could not cancel", { description: data.error });
        return;
      }

      setReservation(data);
      toast.info("Reservation cancelled", {
        description: "Stock has been returned to the warehouse.",
      });
      setTimeout(() => router.push("/"), 1500);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }, [id, reservation, router]);

  const handleExpire = useCallback(() => {
    setExpired(true);
    setReservation((prev) => prev ? { ...prev, status: "released" } : prev);
    toast.warning("Time's up!", {
      description: "Your reservation has expired and stock was returned.",
      duration: 8000,
    });
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading reservation…</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-12 text-center max-w-md space-y-4">
          <div className="text-5xl">🔍</div>
          <h2 className="text-xl font-bold text-destructive">
            {error || "Reservation not found"}
          </h2>
          <p className="text-muted-foreground text-sm">
            This reservation may have been cancelled or never existed.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="mt-4 rounded-xl"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.6 0.2 290))",
            }}
          >
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  const price = parseFloat(reservation.productPrice);
  const total = price * reservation.quantity;
  const formattedTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(total);
  const formattedUnit = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

  const isPending = reservation.status === "pending" && !expired;
  const isConfirmed = reservation.status === "confirmed";
  const isReleased = reservation.status === "released" || expired;

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10"
          style={{
            background:
              "radial-gradient(ellipse, oklch(0.65 0.22 270) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/5 glass-strong">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            id="back-to-products"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Products
          </button>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-sm font-medium">Checkout</span>
          <div className="ml-auto">
            <StatusBadge status={isReleased ? "released" : reservation.status} />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column: timer + actions */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── 409 / 410 Error Banner ── */}
            {errorBanner && (
              <div
                role="alert"
                className="rounded-2xl p-5 border animate-in fade-in slide-in-from-top-3 duration-400"
                style={{
                  background: errorBanner.code === "410"
                    ? "linear-gradient(135deg, oklch(0.22 0.08 15 / 0.8), oklch(0.18 0.05 20 / 0.8))"
                    : "linear-gradient(135deg, oklch(0.22 0.08 30 / 0.8), oklch(0.18 0.05 35 / 0.8))",
                  borderColor: errorBanner.code === "410"
                    ? "oklch(0.55 0.22 15 / 0.6)"
                    : "oklch(0.55 0.18 30 / 0.6)",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon: different per error code */}
                  {errorBanner.code === "410" ? (
                    <svg className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.72 0.22 15)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.72 0.18 30)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-base" style={{ color: errorBanner.code === "410" ? "oklch(0.82 0.18 15)" : "oklch(0.82 0.15 30)" }}>
                      {errorBanner.code === "410" ? "HTTP 410 — " : "HTTP 409 — "}{errorBanner.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "oklch(0.65 0.08 15)" }}>
                      {errorBanner.detail}
                    </p>
                  </div>
                  <button
                    aria-label="Dismiss"
                    className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={() => setErrorBanner(null)}
                    style={{ color: "oklch(0.72 0.22 15)" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Countdown */}
            {isPending && (
              <div className="glass rounded-2xl p-6 flex flex-col items-center fade-up">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  Reservation expires in
                </p>
                <CountdownTimer
                  expiresAt={reservation.expiresAt}
                  onExpire={handleExpire}
                />
              </div>
            )}

            {isConfirmed && (
              <div className="glass rounded-2xl p-6 text-center glow-success fade-up">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="text-lg font-bold text-green-400 mb-1">
                  Purchase Confirmed!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your order is being processed. Thank you!
                </p>
              </div>
            )}

            {isReleased && !isConfirmed && (
              <div className="glass rounded-2xl p-6 text-center fade-up border border-destructive/20">
                <div className="text-5xl mb-3">⏰</div>
                <h2 className="text-lg font-bold text-destructive mb-1">
                  {expired ? "Reservation Expired" : "Reservation Cancelled"}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {expired
                    ? "Time ran out. Stock has been returned."
                    : "You cancelled this reservation."}
                </p>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="rounded-xl border-white/10 w-full"
                >
                  Browse Products
                </Button>
              </div>
            )}

            {/* Actions */}
            {isPending && (
              <div className="space-y-3 fade-up fade-up-delay-1">
                <Button
                  id="confirm-purchase"
                  className="w-full h-12 rounded-xl font-semibold text-base"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.6 0.2 290))",
                    boxShadow: "0 4px 24px oklch(0.65 0.22 270 / 0.35)",
                  }}
                  onClick={handleConfirm}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "confirm" ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing…
                    </span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Confirm Purchase · {formattedTotal}
                    </>
                  )}
                </Button>

                <Button
                  id="cancel-reservation"
                  variant="outline"
                  className="w-full h-11 rounded-xl border-white/10 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                  onClick={handleCancel}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "cancel" ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cancelling…
                    </span>
                  ) : (
                    "Cancel Reservation"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Stock is held exclusively for you until the timer runs out.
                </p>
              </div>
            )}
          </div>

          {/* Right column: reservation details */}
          <div className="lg:col-span-3 space-y-6">
            <div className="fade-up">
              <h1 className="text-2xl font-bold mb-1">Your Reservation</h1>
              <p className="text-muted-foreground text-sm font-mono">
                ID: {reservation.id}
              </p>
            </div>

            {/* Product summary card */}
            <div className="glass rounded-2xl p-6 fade-up fade-up-delay-1">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Item
              </h2>
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.35 0.12 270), oklch(0.25 0.08 290))",
                  }}
                >
                  {reservation.productImageUrl ? (
                    <img
                      src={reservation.productImageUrl}
                      alt={reservation.productName}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <svg
                      className="w-8 h-8 text-white/70"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{reservation.productName}</h3>
                  <p className="text-muted-foreground text-sm font-mono">{reservation.productSku}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {reservation.warehouseName}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {reservation.warehouseLocation}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator className="my-4 bg-white/5" />

              <div className="space-y-0.5">
                <DetailRow label="Unit price" value={formattedUnit} />
                <DetailRow label="Quantity" value={`${reservation.quantity} unit${reservation.quantity > 1 ? "s" : ""}`} />
                <Separator className="bg-white/5 my-2" />
                <div className="flex items-center justify-between py-2">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold gradient-text">{formattedTotal}</span>
                </div>
              </div>
            </div>

            {/* Reservation metadata */}
            <div className="glass rounded-2xl p-6 fade-up fade-up-delay-2">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Reservation Details
              </h2>
              <div className="space-y-0.5">
                <DetailRow label="Status" value={isReleased && expired ? "Expired" : reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)} />
                <DetailRow
                  label="Created"
                  value={new Date(reservation.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <DetailRow
                  label="Expires at"
                  value={new Date(reservation.expiresAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
                <DetailRow label="Warehouse" value={reservation.warehouseName} />
                <DetailRow label="Location" value={reservation.warehouseLocation} />
              </div>
            </div>

            {/* Info note */}
            <div className="glass rounded-xl p-4 flex gap-3 text-sm text-muted-foreground fade-up fade-up-delay-3">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>
                Your reservation is protected against concurrent purchases. Stock is
                decremented permanently only when you confirm payment.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
