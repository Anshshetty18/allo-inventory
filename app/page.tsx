"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ProductCard } from "@/components/ProductCard";
import { ReserveModal } from "@/components/ReserveModal";
import type { ProductWithStock } from "@/schemas";

function ProductListingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-6 space-y-4">
          <div className="skeleton h-48 w-full rounded-xl" />
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="flex gap-2 mt-2">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="skeleton h-10 w-full rounded-xl mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data: ProductWithStock[] = await res.json();
      setProducts(data);
    } catch {
      toast.error("Could not load products. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="min-h-screen">
      {/* ── Background orbs ───────────────────────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-64 -left-64 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.22 270) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle, oklch(0.7 0.2 230) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-48 left-1/3 w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.22 290) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-white/5 glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center glow-primary"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.6 0.2 290))",
              }}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <span className="font-semibold text-lg gradient-text tracking-tight">
              Allo Inventory
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
            <span>Live stock</span>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="fade-up">
          <p className="text-sm font-medium text-primary/80 uppercase tracking-widest mb-3">
            Multi-warehouse fulfilment
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            <span className="gradient-text">Reserve before you buy.</span>
            <br />
            <span className="text-foreground/80">Never lose a sale to bad timing.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Stock is held for 10 minutes while you complete payment — guaranteed race-condition free.
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-6 mt-10 fade-up fade-up-delay-1">
          {[
            { label: "Products", value: products.length || "—" },
            {
              label: "Warehouses",
              value:
                products.length > 0
                  ? new Set(
                      products.flatMap((p) => p.warehouses.map((w) => w.warehouseId))
                    ).size
                  : "—",
            },
            { label: "Hold window", value: "10 min" },
            { label: "Concurrency", value: "Safe" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl px-5 py-3">
              <div className="text-xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product grid ──────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading ? (
          <ProductListingSkeleton />
        ) : products.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold mb-2">No products found</h2>
            <p className="text-muted-foreground">
              The database may not be seeded yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, idx) => (
              <div
                key={product.id}
                className={`fade-up fade-up-delay-${Math.min(idx + 1, 5)}`}
              >
                <ProductCard
                  product={product}
                  onReserve={() => setSelectedProduct(product)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Reserve Modal ─────────────────────────────────────────────────── */}
      <ReserveModal
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSuccess={fetchProducts}
      />
    </div>
  );
}
