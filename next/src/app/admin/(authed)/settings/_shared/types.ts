/* ══════════════════════════════════════════
   _shared/types.ts — settings 폼 공용 타입 (S256-A 분리)

   - UploadState: SignatureSubForm 4 upload slot (html + image 3종) 진행 상태.
   - PreviewBrk: SettingsForm orchestrator 의 Signature Preview iframe 4 brk 토글.
   ══════════════════════════════════════════ */

/** advisory §6.1 D-1 — Signature iframe 업로드 progress / error 표현. */
export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

/** advisory §6.1 D-1 — 발행 전 4 brk 미리보기 검증. */
export type PreviewBrk = 'desktop' | 'laptop' | 'tablet' | 'mobile';

export const PREVIEW_BRK_OPTIONS: ReadonlyArray<{
  key: PreviewBrk;
  label: string;
  width: number;
}> = [
  { key: 'desktop', label: 'Desktop', width: 1440 },
  { key: 'laptop', label: 'Laptop', width: 1024 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'mobile', label: 'Mobile', width: 360 },
];
