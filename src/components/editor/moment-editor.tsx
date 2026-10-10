"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { createId } from "@/lib/id";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, type Asset, type ContentBlock } from "@/lib/model";
import { BoomDuplicateLinkError, BoomMissingMomentError, BoomSelfLinkError } from "@/lib/boom";
import { StorageQuotaError } from "@/lib/db";
import { createMoment, getAsset, getMoment, updateMoment } from "@/lib/moments";
import type { Space } from "@/lib/model";
import { listSpaces, SpaceMissingError, spaceTree } from "@/lib/spaces";

type DraftText = { id: string; type: "text"; text: string };
type DraftImage = {
  id: string;
  type: "image";
  assetId: string;
  alt?: string;
  previewUrl: string;
  pendingBlob?: Blob;
  mimeType?: string;
};
type DraftBlock = DraftText | DraftImage;

export function MomentEditor({
  momentId,
  initialSpaceId = null,
  linkTo = null,
}: {
  momentId?: string;
  initialSpaceId?: string | null;
  linkTo?: [string, string] | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<DraftBlock[]>([{ id: "draft-text", type: "text", text: "" }]);
  const [spaceId, setSpaceId] = useState<string | null>(initialSpaceId);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [baseline, setBaseline] = useState(() =>
    signature("", [{ id: "draft-text", type: "text", text: "" }], initialSpaceId),
  );
  const [ready, setReady] = useState(!momentId);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [canCamera, setCanCamera] = useState(false);
  const createdUrls = useRef<string[]>([]);

  useEffect(() => {
    setCanCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listSpaces()
      .then((next) => {
        if (!cancelled) {
          setSpaces(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.v1.loadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!momentId) {
      return;
    }

    let cancelled = false;
    void getMoment(momentId)
      .then(async (moment) => {
        if (cancelled) {
          return;
        }
        if (!moment) {
          setMissing(true);
          setReady(true);
          return;
        }
        const next: DraftBlock[] = [];
        for (const block of moment.blocks) {
          if (block.type === "text") {
            next.push({ id: block.id, type: "text", text: block.text });
            continue;
          }
          const asset = await getAsset(block.assetId);
          const previewUrl = asset ? URL.createObjectURL(asset.blob) : "";
          if (previewUrl) {
            createdUrls.current.push(previewUrl);
          }
          next.push({
            id: block.id,
            type: "image",
            assetId: block.assetId,
            alt: block.alt,
            previewUrl,
          });
        }
        const loaded = next.length > 0 ? next : [{ id: createId(), type: "text" as const, text: "" }];
        if (!cancelled) {
          setTitle(moment.title ?? "");
          setBlocks(loaded);
          setSpaceId(moment.spaceId);
          setBaseline(signature(moment.title ?? "", loaded, moment.spaceId));
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.v1.loadError);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [momentId]);

  useEffect(() => {
    const urls = createdUrls.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const dirty = useMemo(
    () => ready && signature(title, blocks, spaceId) !== baseline,
    [baseline, blocks, ready, spaceId, title],
  );
  const canSave = useMemo(() => blocks.some((block) => block.type === "image" || block.text.trim().length > 0), [blocks]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function goBack() {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    leave();
  }

  function leave() {
    if (momentId) {
      router.push(`/moments/${momentId}`);
      return;
    }
    router.push("/");
  }

  function addText() {
    setBlocks((current) => [...current, { id: createId(), type: "text", text: "" }]);
  }

  function addFiles(files: FileList | null) {
    if (!files) {
      return;
    }
    const next: DraftImage[] = [];
    let problem: string | null = null;
    for (const file of files) {
      if (!IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) {
        problem = text.v1.imageType;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problem = text.v1.imageSize;
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      createdUrls.current.push(previewUrl);
      next.push({
        id: createId(),
        type: "image",
        assetId: createId(),
        previewUrl,
        pendingBlob: file,
        mimeType: file.type,
      });
    }
    if (next.length > 0) {
      setBlocks((current) => [...current, ...next]);
    }
    setError(problem);
  }

  function move(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function remove(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  async function save() {
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const kept = blocks.filter((block) => block.type === "image" || block.text.trim().length > 0);
    const content: ContentBlock[] = kept.map((block) =>
      block.type === "text"
        ? { id: block.id, type: "text", text: block.text }
        : { id: block.id, type: "image", assetId: block.assetId, ...(block.alt ? { alt: block.alt } : {}) },
    );
    const assets: Asset[] = kept
      .filter((block): block is DraftImage => block.type === "image" && Boolean(block.pendingBlob))
      .map((block) => ({
        id: block.assetId,
        mimeType: block.mimeType || "image/jpeg",
        blob: block.pendingBlob as Blob,
        createdAt: new Date().toISOString(),
      }));

    try {
      if (momentId) {
        const original = await getMoment(momentId);
        const keptIds = new Set(
          content.flatMap((block) => (block.type === "image" ? [block.assetId] : [])),
        );
        const removedAssetIds = (original?.blocks ?? []).flatMap((block) =>
          block.type === "image" && !keptIds.has(block.assetId) ? [block.assetId] : [],
        );
        await updateMoment({ id: momentId, title, blocks: content, assets, removedAssetIds, spaceId });
        router.push(`/moments/${momentId}`);
        return;
      }

      const id = createId();
      await createMoment({
        id,
        title,
        blocks: content,
        assets,
        spaceId,
        ...(linkTo ? { linkTo } : {}),
      });
      router.push("/");
    } catch (caught) {
      setSaving(false);
      setError(
        caught instanceof StorageQuotaError
          ? text.v1.quota
          : caught instanceof SpaceMissingError
            ? text.v1.spaceMissing
            : caught instanceof BoomDuplicateLinkError
              ? text.v1.alreadyConnected
              : caught instanceof BoomSelfLinkError
                ? text.v1.selfLink
                : caught instanceof BoomMissingMomentError
                  ? text.v1.boomMissing
                  : text.v1.saveError,
      );
    }
  }

  if (!ready) {
    return <p className="px-5 py-16 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>;
  }

  if (missing) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[16px] text-[#171717]">{text.v1.missing}</p>
        <button type="button" onClick={() => router.push("/")} className="mt-4 min-h-11 text-[15px]">
          {text.v1.backHome}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="flex items-center justify-between px-4 pt-4">
        <button type="button" onClick={goBack} className="min-h-11 px-2 text-[16px] text-[#8A8A8E]">
          {text.back}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="min-h-11 rounded-[14px] bg-[#171717] px-4 text-[15px] text-white disabled:bg-[#EAEAEA] disabled:text-[#8A8A8E]"
        >
          {saving ? text.v1.saving : text.v1.save}
        </button>
      </header>
      <main className="px-5 pt-4 pb-36">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={text.v1.titlePlaceholder}
          aria-label={text.v1.titlePlaceholder}
          className="w-full bg-transparent text-[28px] font-semibold tracking-[-0.03em] text-[#171717] outline-none placeholder:text-[#8A8A8E]"
        />
        {linkTo ? <p className="mt-3 text-[14px] leading-relaxed text-[#8A8A8E]">{text.v1.boomSaveNote}</p> : null}
        <label className="mt-5 block text-[13px] text-[#8A8A8E]">
          {text.v1.spaceLabel}
          <select
            value={spaceId ?? ""}
            aria-label={text.v1.spaceLabel}
            onChange={(event) => setSpaceId(event.target.value || null)}
            className="mt-2 min-h-11 w-full rounded-[14px] border border-[#EAEAEA] bg-white px-3 text-[16px] text-[#171717]"
          >
            <option value="">{text.v1.unclassified}</option>
            {spaceTree(spaces).map(({ space, depth }) => (
              <option key={space.id} value={space.id}>
                {`${"\u3000".repeat(depth)}${space.name}`}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-6 flex flex-col gap-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-[14px] border border-[#EAEAEA] p-3">
              {block.type === "text" ? (
                <textarea
                  value={block.text}
                  rows={4}
                  placeholder={text.v1.textPlaceholder}
                  aria-label={text.v1.textPlaceholder}
                  onChange={(event) =>
                    setBlocks((current) =>
                      current.map((item) => (item.id === block.id && item.type === "text" ? { ...item, text: event.target.value } : item)),
                    )
                  }
                  className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-[#171717] outline-none placeholder:text-[#8A8A8E]"
                />
              ) : block.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.previewUrl} alt={block.alt || text.v1.imageAlt} className="max-h-80 w-full rounded-[10px] object-cover" />
              ) : (
                <p className="text-[14px] text-[#8A8A8E]">{text.v1.missingImage}</p>
              )}
              <div className="mt-2 flex gap-1">
                <button type="button" aria-label={text.v1.moveUp} disabled={index === 0} onClick={() => move(index, -1)} className="flex size-11 items-center justify-center disabled:opacity-30">
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label={text.v1.moveDown} disabled={index === blocks.length - 1} onClick={() => move(index, 1)} className="flex size-11 items-center justify-center disabled:opacity-30">
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label={text.v1.removeBlock} onClick={() => remove(block.id)} className="ml-auto flex size-11 items-center justify-center">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="mt-4 text-[14px] text-[#171717]">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={addText} className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px]">
            <Plus className="size-4" aria-hidden="true" />
            {text.v1.addText}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px]">
            <ImagePlus className="size-4" aria-hidden="true" />
            {text.v1.addImage}
          </button>
          {canCamera ? (
            <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px]">
              {text.v1.takePhoto}
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_MIME_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </main>
      {leaveOpen ? (
        <ConfirmDialog
          title={text.v1.unsavedTitle}
          body={text.v1.unsavedBody}
          confirmLabel={text.v1.discard}
          cancelLabel={text.v1.continueEditing}
          onCancel={() => setLeaveOpen(false)}
          onConfirm={leave}
        />
      ) : null}
    </div>
  );
}

function signature(title: string, blocks: DraftBlock[], spaceId: string | null) {
  return JSON.stringify({
    title: title.trim(),
    spaceId,
    blocks: blocks.map((block) =>
      block.type === "text" ? { type: "text", text: block.text } : { type: "image", assetId: block.assetId },
    ),
  });
}
