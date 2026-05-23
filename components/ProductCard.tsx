"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { ProductWithStock, WarehouseStock } from "@/schemas";

interface ProductCardProps {
  product: ProductWithStock;
  onReserve: () => void;
}

function StockPill({ warehouse }: { warehouse: WarehouseStock }) {
  const { availableUnits, warehouseName } = warehouse;

  const color =
    availableUnits === 0
      ? "bg-destructive/20 text-destructive border-destructive/30"
      : availableUnits <= 3
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-green-500/20 text-green-400 border-green-500/30";

  const label =
    availableUnits === 0
      ? "Out of stock"
      : availableUnits === 1
      ? "1 left!"
      : `${availableUnits} in stock`;

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 border text-xs font-medium ${color}`}
    >
      <div className="flex items-center gap-1.5">
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span className="truncate max-w-[120px]">{warehouseName}</span>
      </div>
      <span className="ml-2 font-semibold">{label}</span>
    </div>
  );
}

export function ProductCard({ product, onReserve }: ProductCardProps) {
  const totalAvailable = product.warehouses.reduce(
    (sum, w) => sum + w.availableUnits,
    0
  );
  const hasStock = totalAvailable > 0;
  const isLowStock = hasStock && totalAvailable <= 5;

  const price = parseFloat(product.price);
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

  // Generate a deterministic gradient per product based on SKU
  const skuHash = product.sku
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue1 = (skuHash * 37) % 360;
  const hue2 = (hue1 + 60) % 360;

  return (
    <Card className="glass border-white/5 rounded-2xl overflow-hidden card-lift group flex flex-col">
      {/* Product visual */}
      <div
        className="relative h-44 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, oklch(0.35 0.12 ${hue1}) 0%, oklch(0.25 0.08 ${hue2}) 100%)`,
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
          style={{
            background: `oklch(0.7 0.2 ${hue1})`,
          }}
        />
        <div
          className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-20"
          style={{
            background: `oklch(0.6 0.18 ${hue2})`,
          }}
        />

        {/* SKU badge */}
        <div className="absolute top-3 left-3">
          <Badge
            variant="secondary"
            className="bg-black/30 text-white/80 border-white/10 backdrop-blur-sm text-xs font-mono"
          >
            {product.sku}
          </Badge>
        </div>

        {/* Low/Out of stock overlay */}
        {!hasStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Badge className="bg-destructive text-white text-sm px-4 py-1.5 font-semibold">
              Out of Stock
            </Badge>
          </div>
        )}
        {isLowStock && hasStock && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-amber-500/90 text-white text-xs font-semibold animate-pulse">
              Low stock
            </Badge>
          </div>
        )}

        {/* Product image or icon fallback */}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="relative z-10 h-36 w-auto max-w-[75%] object-contain drop-shadow-2xl
                       transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="relative z-10 text-white/90">
            <svg
              className="w-16 h-16 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        )}
      </div>

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-base leading-tight text-foreground group-hover:text-primary transition-colors">
            {product.name}
          </h2>
          <span
            className="text-lg font-bold shrink-0 gradient-text"
          >
            {formattedPrice}
          </span>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed mt-1 line-clamp-2">
          {product.description}
        </p>
      </CardHeader>

      <CardContent className="py-2 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Warehouse availability
        </p>
        <div className="space-y-1.5">
          {product.warehouses.map((wh) => (
            <StockPill key={wh.warehouseId} warehouse={wh} />
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-4">
        <Button
          id={`reserve-${product.id}`}
          className="w-full rounded-xl font-semibold transition-all duration-200"
          style={
            hasStock
              ? {
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.6 0.2 290))",
                  boxShadow: "0 4px 20px oklch(0.65 0.22 270 / 0.3)",
                }
              : undefined
          }
          disabled={!hasStock}
          onClick={onReserve}
        >
          {hasStock ? (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Reserve Now
            </>
          ) : (
            "Out of Stock"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
