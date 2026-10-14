import { MomentEditor } from "@/components/editor/moment-editor";

export default async function NewMomentPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; link?: string | string[] }>;
}) {
  const params = await searchParams;
  return <MomentEditor initialSpaceId={params.space?.trim() || null} linkTo={linkSources(params.link)} />;
}

function linkSources(value: string | string[] | undefined) {
  const ids = [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim()).filter(Boolean))];
  if (ids.length >= 2) {
    return ids;
  }
  return null;
}
