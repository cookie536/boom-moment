"use client";

import { useParams } from "next/navigation";
import { ReadingLayer } from "@/components/moment/reading-layer";

export default function MomentPage() {
  const params = useParams<{ id: string }>();
  return <ReadingLayer id={params.id} />;
}
