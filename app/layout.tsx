import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Allo Inventory | Multi-Warehouse Stock Management",
  description:
    "Real-time inventory reservation system for multi-warehouse retail. Reserve stock during checkout, prevent overselling, and manage warehouse fulfilment.",
  keywords: ["inventory", "reservations", "warehouse", "retail", "stock management"],
  openGraph: {
    title: "Allo Inventory",
    description: "Race-condition-safe inventory reservation for multi-warehouse brands.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
