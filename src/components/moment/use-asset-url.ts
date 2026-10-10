"use client";

import { useEffect, useState } from "react";
import { thumbnailUrl } from "@/lib/images";
import { getAsset } from "@/lib/moments";

export function useAssetUrl(assetId: string | null, thumb = false) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!assetId) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void getAsset(assetId)
      .then(async (asset) => {
        if (cancelled) {
          return;
        }
        if (!asset) {
          setMissing(true);
          return;
        }
        objectUrl = thumb ? await thumbnailUrl(asset.blob) : URL.createObjectURL(asset.blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [assetId, thumb]);

  return { url, missing };
}
