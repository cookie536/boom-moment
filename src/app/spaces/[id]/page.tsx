"use client";

import { useParams } from "next/navigation";
import { SpaceDetailScreen } from "@/components/space/space-detail-screen";

export default function SpacePage() {
  const params = useParams<{ id: string }>();
  return <SpaceDetailScreen id={params.id} />;
}
