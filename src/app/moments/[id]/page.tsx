"use client";

import { useParams } from "next/navigation";
import { MomentDetail } from "@/components/moment/moment-detail";

export default function MomentPage() {
  const params = useParams<{ id: string }>();
  return <MomentDetail id={params.id} />;
}
