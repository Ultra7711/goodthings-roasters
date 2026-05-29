'use client';

/* ══════════════════════════════════════════════════════════════════════════
   NewsletterComposer — /admin/newsletter [발송] 탭 본체 (S250-2 Phase 2)

   - 제목 + 블록(heading/paragraph/image/cta) 편집기 (WYSIWYG 아님 = 블록 폼)
   - 우측 iframe 라이브 미리보기 (renderNewsletterEmail · 순수함수 client import)
   - 이미지: uploadNewsletterImageAction → newsletter-images 절대 URL
   - 테스트 발송(단일) → sendTestNewsletterAction
   - 실제 발송: ConfirmModal "N명에게 발송" → sendNewsletterCampaignAction (owner 전용)
   ══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ImagePlus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Textarea } from '@/components/admin/ui/textarea';
import { Label } from '@/components/admin/ui/label';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { describeUploadError } from '@/lib/admin/errorDescribe';
import {
  NEWSLETTER_BLOCK_LABEL,
  NEWSLETTER_SUBJECT_MAX,
  createEmptyBlock,
  newsletterDraftSchema,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterDraft,
} from '@/lib/admin/newsletterCompose';
import { renderNewsletterEmail } from '@/lib/email/templates/newsletterEmail';
import { uploadNewsletterImageAction } from './imageActions';
import {
  sendNewsletterCampaignAction,
  sendTestNewsletterAction,
} from './actions';

const PREVIEW_TOKEN = '00000000-0000-0000-0000-000000000000';
const ADD_TYPES: NewsletterBlockType[] = ['heading', 'paragraph', 'image', 'cta'];

type Props = {
  isOwner: boolean;
  activeCount: number;
  defaultTestEmail: string;
  initialDraft?: NewsletterDraft | null;
};

/* 미리보기용 — 미완성 블록(빈 텍스트·src 등) 제거해 깔끔한 프리뷰 */
function completeBlocks(blocks: NewsletterBlock[]): NewsletterBlock[] {
  return blocks.filter((b) => {
    switch (b.type) {
      case 'heading':
      case 'paragraph':
        return b.text.trim().length > 0;
      case 'image':
        return b.src.trim().length > 0;
      case 'cta':
        return b.label.trim().length > 0 && b.url.trim().length > 0;
    }
  });
}

export default function NewsletterComposer({
  isOwner,
  activeCount,
  defaultTestEmail,
  initialDraft,
}: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialDraft?.subject ?? '');
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(
    initialDraft?.blocks ?? [createEmptyBlock('heading'), createEmptyBlock('paragraph')],
  );
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isTesting, startTest] = useTransition();
  const [isSending, startSend] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIdx = useRef<number | null>(null);

  /* ── 블록 편집 ─────────────────────────────────────────────────────── */

  function updateBlock(idx: number, patch: Partial<NewsletterBlock>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === idx ? ({ ...b, ...patch } as NewsletterBlock) : b)),
    );
  }

  function addBlock(type: NewsletterBlockType) {
    setBlocks((prev) => [...prev, createEmptyBlock(type)]);
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  /* ── 이미지 업로드 ─────────────────────────────────────────────────── */

  function triggerUpload(idx: number) {
    uploadTargetIdx.current = idx;
    fileInputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    const idx = uploadTargetIdx.current;
    if (idx === null || !file) return;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const result = await uploadNewsletterImageAction(formData);
      if (!result.ok) {
        toast.error(describeUploadError(result.error, result.detail));
        return;
      }
      updateBlock(idx, { src: result.src } as Partial<NewsletterBlock>);
      toast.success('이미지를 업로드했습니다.');
    } finally {
      setUploadingIdx(null);
      uploadTargetIdx.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /* ── 미리보기 ──────────────────────────────────────────────────────── */

  const previewHtml = useMemo(() => {
    const visible = completeBlocks(blocks);
    if (subject.trim().length === 0 && visible.length === 0) return '';
    return renderNewsletterEmail({
      subject: subject || '(제목 없음)',
      blocks: visible,
      unsubscribeToken: PREVIEW_TOKEN,
    }).html;
  }, [subject, blocks]);

  /* ── 검증 ──────────────────────────────────────────────────────────── */

  const validation = useMemo(
    () => newsletterDraftSchema.safeParse({ subject, blocks }),
    [subject, blocks],
  );
  const draft: NewsletterDraft | null = validation.success ? validation.data : null;
  const validationMessage = validation.success
    ? null
    : (validation.error.issues[0]?.message ?? '입력값을 확인해 주세요.');

  /* ── 발송 ──────────────────────────────────────────────────────────── */

  function handleTestSend() {
    if (!draft) {
      toast.error('내용을 먼저 완성해 주세요.');
      return;
    }
    if (testEmail.trim().length === 0) {
      toast.error('테스트 수신 이메일을 입력해 주세요.');
      return;
    }
    startTest(async () => {
      const result = await sendTestNewsletterAction(draft, testEmail.trim());
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '권한이 없습니다.',
          validation_failed: '입력값을 확인해 주세요.',
          send_failed: '발송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      toast.success(`테스트 메일을 ${testEmail.trim()} 로 발송했습니다.`);
    });
  }

  function handleConfirmSend() {
    if (!draft) return;
    startSend(async () => {
      const result = await sendNewsletterCampaignAction(draft);
      setConfirmOpen(false);
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '관리자(owner) 권한이 필요합니다.',
          validation_failed: '입력값을 확인해 주세요.',
          no_recipients: '발송 대상(활성 구독자)이 없습니다.',
          server_error: '발송 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      if (result.failedCount > 0) {
        toast.warning(
          `${result.sentCount}/${result.recipientCount}건 발송 완료 (${result.failedCount}건 실패).`,
        );
      } else {
        toast.success(`${result.sentCount}명에게 발송을 완료했습니다.`);
      }
      router.refresh();
    });
  }

  /* ── 렌더 ──────────────────────────────────────────────────────────── */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 좌: 편집기 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nl-subject">제목 (메일 제목줄)</Label>
          <Input
            id="nl-subject"
            value={subject}
            maxLength={NEWSLETTER_SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="예: 5월 시즌 원두 출시 안내"
          />
        </div>

        <div className="flex flex-col gap-3">
          {blocks.map((block, idx) => (
            <BlockEditor
              key={idx}
              block={block}
              index={idx}
              total={blocks.length}
              uploading={uploadingIdx === idx}
              onChange={(patch) => updateBlock(idx, patch)}
              onMove={(dir) => moveBlock(idx, dir)}
              onRemove={() => removeBlock(idx)}
              onUpload={() => triggerUpload(idx)}
            />
          ))}
        </div>

        {/* 블록 추가 */}
        <div className="flex flex-wrap gap-2">
          {ADD_TYPES.map((t) => (
            <Button
              key={t}
              type="button"
              variant="outline"
              size="sm"
              className="!h-8"
              onClick={() => addBlock(t)}
            >
              + {NEWSLETTER_BLOCK_LABEL[t]}
            </Button>
          ))}
        </div>

        {validationMessage && (
          <p className="text-xs text-[var(--danger)]">{validationMessage}</p>
        )}

        {/* 테스트 발송 */}
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <Label htmlFor="nl-test-email">테스트 발송</Label>
          <div className="flex gap-2">
            <Input
              id="nl-test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-9 shrink-0"
              onClick={handleTestSend}
              disabled={!draft || isTesting}
            >
              {isTesting ? '발송 중…' : '테스트 발송'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            실제 발송 전, 본인 이메일로 받아 레이아웃·이미지·구독취소 링크를 확인하세요.
          </p>
        </div>

        {/* 실제 발송 */}
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="!h-9"
            onClick={() => setConfirmOpen(true)}
            disabled={!draft || !isOwner || isSending || activeCount === 0}
            title={
              !isOwner
                ? '발송은 관리자(owner) 권한이 필요합니다'
                : activeCount === 0
                  ? '활성 구독자가 없습니다'
                  : undefined
            }
          >
            <Send />
            활성 구독자 {activeCount.toLocaleString()}명에게 발송
          </Button>
          {!isOwner && (
            <p className="text-xs text-muted-foreground">
              발송 권한은 관리자(owner)에게 있습니다.
            </p>
          )}
        </div>
      </div>

      {/* 우: 미리보기 */}
      <div className="lg:sticky lg:top-4 self-start w-full">
        <div className="text-xs text-muted-foreground mb-1.5">미리보기</div>
        <div className="border border-border rounded-md overflow-hidden bg-white">
          {previewHtml ? (
            <iframe
              title="뉴스레터 미리보기"
              srcDoc={previewHtml}
              className="w-full"
              style={{ height: 640, border: 0 }}
            />
          ) : (
            <div className="px-4 py-16 text-center text-muted-foreground text-sm">
              제목·내용을 입력하면 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </div>

      {/* 숨김 파일 input (이미지 블록 공유) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/webp,image/avif,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <ConfirmModal
        open={confirmOpen}
        title="뉴스레터 발송"
        description={
          <>
            현재 <strong>활성 구독자 {activeCount.toLocaleString()}명</strong> 전원에게
            발송합니다. 발송 후에는 취소할 수 없습니다. 계속할까요?
          </>
        }
        confirmLabel="발송"
        pending={isSending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSend}
      />
    </div>
  );
}

/* ─── 블록 에디터 ─────────────────────────────────────────────────────── */

type BlockEditorProps = {
  block: NewsletterBlock;
  index: number;
  total: number;
  uploading: boolean;
  onChange: (patch: Partial<NewsletterBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUpload: () => void;
};

function BlockEditor({
  block,
  index,
  total,
  uploading,
  onChange,
  onMove,
  onRemove,
  onUpload,
}: BlockEditorProps) {
  return (
    <div className="border border-border rounded-md p-3 bg-card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {NEWSLETTER_BLOCK_LABEL[block.type]}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="!h-7 !w-7"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="위로 이동"
          >
            <ArrowUp size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="!h-7 !w-7"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="아래로 이동"
          >
            <ArrowDown size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="!h-7 !w-7 text-[var(--danger)]"
            onClick={onRemove}
            aria-label="블록 삭제"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {block.type === 'heading' && (
        <Input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<NewsletterBlock>)}
          placeholder="제목 텍스트"
        />
      )}

      {block.type === 'paragraph' && (
        <Textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<NewsletterBlock>)}
          placeholder="문단 내용 (줄바꿈 가능)"
          rows={4}
        />
      )}

      {block.type === 'image' && (
        <div className="flex flex-col gap-2">
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt}
              className="w-full rounded border border-border"
            />
          ) : (
            <div className="w-full rounded border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              이미지를 업로드하세요
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-8"
              onClick={onUpload}
              disabled={uploading}
            >
              <ImagePlus size={14} />
              {uploading ? '업로드 중…' : block.src ? '이미지 변경' : '이미지 업로드'}
            </Button>
          </div>
          <Input
            value={block.alt}
            onChange={(e) => onChange({ alt: e.target.value } as Partial<NewsletterBlock>)}
            placeholder="대체 텍스트 (이미지 설명 · 선택)"
          />
          <Input
            value={block.href ?? ''}
            onChange={(e) =>
              onChange({
                href: e.target.value.trim().length > 0 ? e.target.value : undefined,
              } as Partial<NewsletterBlock>)
            }
            placeholder="클릭 시 이동 URL (https:// · 선택)"
          />
        </div>
      )}

      {block.type === 'cta' && (
        <div className="flex flex-col gap-2">
          <Input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value } as Partial<NewsletterBlock>)}
            placeholder="버튼 문구 (예: 사이트 둘러보기)"
          />
          <Input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<NewsletterBlock>)}
            placeholder="버튼 링크 (https://)"
          />
        </div>
      )}
    </div>
  );
}
