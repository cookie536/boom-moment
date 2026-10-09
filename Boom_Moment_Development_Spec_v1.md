# Boom Moment — Development Specification v1.0

Status: implementation-ready baseline, 2026-10-09.

## 1. Product contract
A private, mobile-first inspiration recorder. The home page is a two-column masonry-style feed of the user's own Moments, sorted by `updatedAt` descending. Toggle to a compact text list with the same sort. Recording is the primary job; Boom linking and optional creation are secondary. No social feed, gamification, forced categorization, or unsolicited AI.

## 2. Stack and architecture
- Next.js App Router, TypeScript strict, Tailwind CSS, client components where browser storage is needed.
- IndexedDB with `idb` (or Dexie), schema versioning and migrations; no localStorage for images.
- PWA later; no server/database/auth required for the local-first MVP.
- Use UUIDs for IDs, ISO UTC timestamps for persisted dates, display in local timezone.
- `createdAt` never changes; `updatedAt` updates only on content/metadata edits, not on reading.
- Images stored as Blob records keyed by UUID; thumbnail derived for feed, original retained for export.
- Avoid remote AI/API keys in client bundle.

## 3. Core entities
```ts
type Id = string;
type ContentBlock =
  | { id: Id; type: 'text'; text: string }
  | { id: Id; type: 'image'; assetId: Id; alt?: string };
interface Moment {
  id: Id;
  title?: string;
  blocks: ContentBlock[];
  spaceId: Id | null;
  createdAt: string;
  updatedAt: string;
}
interface Space {
  id: Id;
  name: string;
  parentId: Id | null;
  createdAt: string;
  updatedAt: string;
}
interface BoomLink {
  id: Id;
  aId: Id;
  bId: Id;
  createdAt: string;
}
interface Asset {
  id: Id;
  mimeType: string;
  blob: Blob;
  createdAt: string;
}
```
- `BoomLink` is an undirected pair, stored canonically with sorted endpoint IDs to prevent duplicate edges; disallow self-links.
- Optional creative output: create Moment C and link it to A and B. The links and new Moment should be committed in one transaction.
- A Moment belongs to zero or one Space; Spaces can nest without cycles. A Moment can have many Boom links across Spaces.
- Derive display title from first nonempty text line when title is missing; for image-only Moment use “未命名 Moment”. Do not write derived title back unless user edits it.

## 4. Route map
| Route | Purpose |
|---|---|
| `/` | Home: card feed/list toggle, Space chips, search shortcut |
| `/moments/new` | Create Moment |
| `/moments/[id]` | Read Moment, action menu, related Moments |
| `/moments/[id]/edit` | Edit Moment, reuse editor |
| `/search` | Search titles and text blocks; Space filter |
| `/spaces` | Top-level Spaces, Unclassified |
| `/spaces/[id]` | Direct Moments and child Spaces; nested navigation |
| `/boom` | Start a Boom; recent connections |
| `/boom/new?from=<id>` | Select other Moment and connection mode |
| `/settings` | Appearance, backup/restore, information |
| `/settings/backup` | Export/import full backup |
| `/moments/[id]/share` | Export preview, copy/share image |

## 5. Navigation and visual tokens
- Bottom tabs: Home, Spaces, central `+`, Boom, Settings. Hide tabs when editing and in modal flows.
- White canvas `#FFFFFF`, primary text `#171717`, secondary `#8A8A8E`, subtle borders `#EAEAEA`, radius 14px, grid gap 12px.
- Accessible contrast, 44x44px minimum touch targets, safe-area insets, reduced-motion support.
- All primary UI copy in Chinese; no fake recommendation feed.

## 6. Screens and behaviors
### Home
- Card masonry two columns, first image (if any) as cover, then title/preview and last-edited time; text-only card uses text without filler image.
- Toggle to text list; persist view preference. Both sorted `updatedAt DESC`, stable tie-break by ID.
- Space chips filter, default All; only own data.
- Card tap opens detail; long press or overflow menu opens Edit / Move to Space / Share / Delete.
- Empty state CTA “创建第一个 Moment”. Search has zero-result state.

### Editor (new/edit)
- Optional title, ordered text/image blocks, multiple image insertion, delete/reorder images, camera when supported.
- Save enabled if at least one nonempty text block or image block exists. Space optional; no required tags.
- On unsaved exit: Discard / Continue editing. Draft recovery optional after base editor stable.
- On save, persist blocks and assets transactionally; return to Home for new Moment and detail for edits. New/edited items sort to top.
- V1 voice and URL parsing are deferred; UI must not show nonfunctional buttons as if implemented.

### Detail
- Render blocks in original order; full-screen image viewer. Edit, Boom, More, Share.
- Back preserves prior scroll/filter when possible.
- Related Moments show linked titles; unlink is separate from delete.
- Delete confirms affected link count; remove incident links. Never silently reconnect branched networks. A–B–C repair is an explicit future option, not default.

### Spaces
- List root Spaces, counts, Unclassified; inside Space tabs: direct Moments and child Spaces.
- Create nested Space; rename; move to another parent with cycle checks; delete with explicit preview.
- Deleting a Space reparents its direct child Spaces and direct Moments to the deleted Space's parent, or Unclassified at root. This is transactional and does not delete Moment content or Boom links.
- From inside Space, `+` creates Moment preselected to current Space, user can change it.

### Boom
- Entry from tab or detail; choose A and B (not same ID), via search/filter.
- Preview both; two actions: `仅建立连接` and `连接并创建新想法`.
- Simple link: persist edge and show small silent, non-haptic spark; optional output: open editor for C, link C to A/B only on successful save.
- AI-generated collision deferred to later version; no simulated AI output.

### Settings, backup and share
- Appearance: light/dark/system (dark theme only if implemented across screens; otherwise omit switch).
- Backup: ZIP archive with manifest JSON, Moments, Spaces, BoomLinks and binary assets. Version schema, checksum optional; test roundtrip.
- Restore: validate version, refs and assets; show preview counts, conflict strategy (merge by ID, skip identical; ask before replacing changed data); atomic import or rollback on failure.
- Share: export a single Moment as readable PNG; include text and images; long entries can be paginated or offer text copy; share via Web Share API if supported, fallback download.
- Explain local data can be lost if browser data is cleared; encourage backup.

## 7. Storage indexes and consistency
- Index `moments.updatedAt`, `moments.spaceId`, `spaces.parentId`, `links.aId`, `links.bId`.
- Referential integrity checks for spaceId, assetId and link endpoints.
- Deleting Moment also cleans orphaned assets only if no other references; links removed in same transaction.
- Image Blob object URLs revoked after use; limit uploads by type/size and show meaningful errors.
- Storage quota errors must never claim save success.

## 8. Component inventory
`AppShell`, `BottomNav`, `MomentCard`, `MomentListRow`, `SpaceChip`, `SearchField`, `EmptyState`, `MomentEditor`, `ContentBlockEditor`, `ImagePicker`, `ImageViewer`, `MomentActions`, `SpacePicker`, `SpaceRow`, `BoomMomentPicker`, `BoomPreview`, `RelatedMoments`, `ConfirmDialog`, `ExportPreview`, `Toast`.

## 9. Accessibility and edge cases
- Keyboard focus and Escape for dialogs, descriptive button labels, image alt text if supplied.
- Large text and narrow devices; keyboard must not cover Save.
- No Moments, no Spaces, no search results, image-only Moment, extremely long text, offline use, storage full, corrupted backup, missing assets, deleted linked Moment, deep Space nesting, circular moves, duplicate links.
- Show explicit success only after committed storage transaction.

## 10. Implementation phases
**Phase A — reliable recording:** Scaffold app, IndexedDB, Moment CRUD, text and image blocks, Home feed/list, detail, search. Acceptance: refresh preserves data and image blobs; edit reorders; no phantom saves.

**Phase B — organization:** Spaces nesting, filter, picker, move, delete/reparent. Acceptance: moving preserves Boom links; no cycles; deletion retains Moments.

**Phase C — Boom:** Two-Moment picker, canonical link, unlink, related list, optional creative C, subtle animation. Acceptance: duplicate/self-links rejected; originals unchanged.

**Phase D — portability:** PNG export, ZIP backup/restore, data warnings, QA. Acceptance: export/import on clean browser reconstructs text, images, spaces and links.

## 11. Definition of done
- Core flows pass on mobile viewport and desktop; keyboard and touch both usable.
- Data persists after refresh and browser restart; tested with images.
- No placeholder buttons that falsely claim functionality.
- No silent data loss; confirmation for destructive operations; backup roundtrip passes.
- Typecheck, lint and build pass; at least CRUD, Space move, Boom-link and backup roundtrip automated tests.

## 12. Cursor master prompt
You are implementing Boom Moment v1.0 from this specification. Treat it as the source of truth. Build a private, local-first, mobile-first Next.js + TypeScript + Tailwind app. Do not invent features or replace local data with mocked data. Start with Phase A only, complete it, run typecheck/lint/build and report the changed files and manual verification steps. Use IndexedDB with schema migrations for Moments and image Blobs. Keep UI consistent with Apple-like white/black/gray minimal design. Home defaults to a two-column card feed sorted by updatedAt descending, toggle to a compact text list. New Moment editor supports optional title, text and multiple images; save must persist after refresh. Include empty, loading, error and storage-quota states. Avoid fake AI, auth, social feed, or inactive buttons. After Phase A passes, stop and ask to proceed to Phase B.

## 13. Decisions pending after functional MVP
- Native share extension / capture from other apps.
- Speech recording and transcription.
- AI-assisted creative Boom, with privacy and model-cost considerations.
- Multi-device sync and Chinese-friendly authentication.
- Advanced export layouts, yearly growth review.
