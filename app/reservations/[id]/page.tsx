import { ReservationPageClient } from "@/components/ReservationPageClient";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Reservation ${id.slice(0, 8)}… | Allo Inventory`,
    description: "Complete your purchase before the reservation expires.",
  };
}

export default async function ReservationPage({ params }: PageProps) {
  const { id } = await params;
  return <ReservationPageClient id={id} />;
}
