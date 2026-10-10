"use client";

import { useParams } from "next/navigation";
import { MomentEditor } from "@/components/editor/moment-editor";

export default function EditMomentPage() {
  const params = useParams<{ id: string }>();
  return <MomentEditor momentId={params.id} />;
}
