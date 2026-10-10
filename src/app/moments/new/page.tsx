import { MomentEditor } from "@/components/editor/moment-editor";

export default async function NewMomentPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; link?: string | string[] }>;
}) {
  const params = await searchParams;
  return <MomentEditor initialSpaceId={params.space?.trim() || null} linkTo={linkPair(params.link)} />;
}

function linkPair(value: string | string[] | undefined): [string, string] | null {
  const ids = (Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim()).filter(Boolean);
  if (ids.length === 2 && ids[0] !== ids[1]) {
    return [ids[0], ids[1]];
  }
  return null;
}
