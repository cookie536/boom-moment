"use client";

import { useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import {
  BackupError,
  applyMerge,
  applyReplace,
  backupFileName,
  conflictCount,
  exportBackup,
  MAX_ZIP_BYTES,
  parseBackup,
  planMerge,
  type BackupArchive,
  type MergeChoice,
  type MergePlan,
} from "@/lib/backup";
import { getDatabase, StorageQuotaError } from "@/lib/db";

type Counts = { moments: number; spaces: number; links: number; booms: number };

export function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [archive, setArchive] = useState<BackupArchive | null>(null);
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaceStep, setReplaceStep] = useState<0 | 1 | 2>(0);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCounts()
      .then((next) => {
        if (!cancelled) {
          setCounts(next);
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

  async function refresh() {
    setCounts(await loadCounts());
  }

  async function onExport() {
    if (busy || exporting) {
      return;
    }
    setExporting(true);
    setMessage(null);
    setError(null);
    try {
      const bytes = await exportBackup();
      downloadZip(bytes, backupFileName());
      setMessage(text.v1.exportReady);
    } catch {
      setMessage(null);
      setError(text.v1.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  async function onFile(file: File | undefined) {
    setArchive(null);
    setPlan(null);
    setMessage(null);
    setError(null);
    setMergeOpen(false);
    setConflictOpen(false);
    setReplaceStep(0);
    if (!file) {
      return;
    }
    if (file.size > MAX_ZIP_BYTES) {
      setError(text.v1.backupTooLarge);
      return;
    }
    setBusy(true);
    try {
      const next = await parseBackup(new Uint8Array(await file.arrayBuffer()));
      setArchive(next);
      setPlan(await planMerge(next));
    } catch (caught) {
      setError(backupMessage(caught));
    } finally {
      setBusy(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function askMerge() {
    if (!archive || !plan || busy) {
      return;
    }
    const added = plan.addMoments + plan.addSpaces + plan.addLinks + plan.addBooms + plan.addAssets;
    if (conflictCount(plan) > 0) {
      setConflictOpen(true);
      return;
    }
    if (added === 0) {
      setMessage(text.v1.mergeNone);
      return;
    }
    setMergeOpen(true);
  }

  async function runMerge(choice: MergeChoice) {
    if (!archive || busy) {
      return;
    }
    setMergeOpen(false);
    setConflictOpen(false);
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await applyMerge(archive, choice);
      setArchive(null);
      setPlan(null);
      await refresh();
      if (result.added === 0 && result.replaced === 0) {
        setMessage(text.v1.mergeNone);
      } else {
        setMessage(text.v1.mergeDone(result.added, result.replaced, result.skipped));
      }
    } catch (caught) {
      setMessage(null);
      setError(backupMessage(caught));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function runReplace() {
    if (!archive || busy) {
      return;
    }
    setReplaceStep(0);
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await applyReplace(archive);
      setArchive(null);
      setPlan(null);
      await refresh();
      setMessage(text.v1.replaceDone);
    } catch (caught) {
      setMessage(null);
      setError(backupMessage(caught));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const added = plan ? plan.addMoments + plan.addSpaces + plan.addLinks + plan.addBooms + plan.addAssets : 0;
  const same = plan ? plan.sameMoments + plan.sameSpaces + plan.sameLinks + plan.sameBooms + plan.sameAssets : 0;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-5 pt-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.settings}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#171717]">{text.v1.settingsNote}</p>
      </header>
      <main className="flex flex-col gap-10 px-5 pt-8 pb-32">
        <section>
          <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.backupSection}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#8A8A8E]">{text.v1.backupBody}</p>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={busy || exporting}
            className="mt-4 min-h-11 rounded-[14px] bg-[#171717] px-4 text-[15px] text-white disabled:bg-[#EAEAEA] disabled:text-[#8A8A8E]"
          >
            {exporting ? text.v1.exporting : text.v1.exportBackup}
          </button>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.restoreSection}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#8A8A8E]">{text.v1.restoreBody}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || exporting}
            className="mt-4 min-h-11 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717] disabled:text-[#8A8A8E]"
          >
            {text.v1.chooseBackup}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-label={text.v1.chooseBackup}
            onChange={(event) => {
              const file = event.target.files?.[0];
              void onFile(file);
            }}
          />
          {archive ? (
            <div className="mt-4 rounded-[14px] border border-[#EAEAEA] p-4">
              <p className="text-[15px] text-[#171717]">{text.v1.backupPreview}</p>
              <ul className="mt-3 flex flex-col gap-1 text-[15px] text-[#171717]">
                <li>{archive.moments.length} 个 Moment</li>
                <li>{archive.spaces.length} 个空间</li>
                <li>{archive.links.length} 条旧连接</li>
                <li>{archive.boomsIncluded ? `${archive.booms.length} 次 Boom` : text.v1.backupNoBooms}</li>
                <li>{archive.assets.length} 张图片</li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={askMerge}
                  disabled={busy}
                  className="min-h-11 rounded-[14px] bg-[#171717] px-4 text-[15px] text-white disabled:bg-[#EAEAEA]"
                >
                  {text.v1.mergeData}
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceStep(1)}
                  disabled={busy}
                  className="min-h-11 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717]"
                >
                  {text.v1.replaceData}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.statsSection}</h2>
          <dl className="mt-3 divide-y divide-[#EAEAEA] border-y border-[#EAEAEA]">
            <Stat label={text.v1.statMoments} value={counts?.moments} />
            <Stat label={text.v1.statSpaces} value={counts?.spaces} />
            <Stat label={text.v1.statLinks} value={counts?.links} />
            <Stat label={text.v1.statBooms} value={counts?.booms} />
          </dl>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.aboutSection}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#8A8A8E]">{text.v1.aboutBody}</p>
        </section>

        {message ? <p className="text-[15px] text-[#171717]">{message}</p> : null}
        {error ? <p className="text-[15px] text-[#171717]">{error}</p> : null}
      </main>
      <BottomNav />
      {mergeOpen ? (
        <ConfirmDialog
          title={text.v1.mergeConfirmTitle}
          body={text.v1.mergeConfirmBody(added, same)}
          confirmLabel={text.v1.mergeData}
          cancelLabel={text.v1.cancel}
          onCancel={() => setMergeOpen(false)}
          onConfirm={() => void runMerge("keep-local")}
        />
      ) : null}
      {conflictOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[14px] bg-white p-5">
            <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.conflictTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#8A8A8E]">
              {text.v1.conflictBody(plan ? conflictCount(plan) : 0)}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void runMerge("keep-local")}
                className="min-h-11 rounded-[14px] bg-[#171717] text-[15px] text-white"
              >
                {text.v1.keepLocal}
              </button>
              <button
                type="button"
                onClick={() => void runMerge("use-backup")}
                className="min-h-11 rounded-[14px] border border-[#EAEAEA] text-[15px] text-[#171717]"
              >
                {text.v1.useBackup}
              </button>
              <button
                type="button"
                onClick={() => setConflictOpen(false)}
                className="min-h-11 rounded-[14px] text-[15px] text-[#8A8A8E]"
              >
                {text.v1.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {replaceStep === 1 ? (
        <ConfirmDialog
          title={text.v1.replaceTitle}
          body={text.v1.replaceBody}
          confirmLabel={text.v1.replaceContinue}
          cancelLabel={text.v1.cancel}
          onCancel={() => setReplaceStep(0)}
          onConfirm={() => setReplaceStep(2)}
        />
      ) : null}
      {replaceStep === 2 ? (
        <ConfirmDialog
          title={text.v1.replaceAgainTitle}
          body={text.v1.replaceAgainBody}
          confirmLabel={text.v1.replaceNow}
          cancelLabel={text.v1.cancel}
          onCancel={() => setReplaceStep(0)}
          onConfirm={() => void runReplace()}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <dt className="text-[16px] text-[#171717]">{label}</dt>
      <dd className="text-[16px] text-[#8A8A8E]">{value === undefined ? "…" : value}</dd>
    </div>
  );
}

async function loadCounts(): Promise<Counts> {
  const database = await getDatabase();
  const [moments, spaces, links, booms] = await Promise.all([
    database.count("moments"),
    database.count("spaces"),
    database.count("boomLinks"),
    database.count("booms"),
  ]);
  return { moments, spaces, links, booms };
}

function downloadZip(bytes: Uint8Array, name: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function backupMessage(error: unknown) {
  if (error instanceof StorageQuotaError) {
    return text.v1.quota;
  }
  if (error instanceof BackupError) {
    if (error.code === "tooLarge") {
      return text.v1.backupTooLarge;
    }
    if (error.code === "version") {
      return text.v1.backupVersion;
    }
    if (error.code === "unsafe") {
      return text.v1.backupUnsafe;
    }
    if (error.code === "integrity") {
      return text.v1.backupIntegrity;
    }
    if (error.code === "boomRefs") {
      return text.v1.backupBoomRefs;
    }
    return text.v1.backupFormat;
  }
  return text.v1.backupFailed;
}
