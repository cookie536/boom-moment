import { BoomDetailScreen } from "@/components/boom/boom-detail-screen";

export default async function BoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoomDetailScreen id={id} />;
}
