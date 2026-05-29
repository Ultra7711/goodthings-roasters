'use client';

/* ══════════════════════════════════════════════════════════════════════════
   NewsletterClient — /admin/newsletter 인터랙티브 본체 (S250-2)

   - 섹션 탭(구독자 / 발송 / 발송 이력) = client state (발송·이력 = Phase 2 placeholder)
   - 구독자 패널: 상태 탭(전체/활성/거부) + 검색 + 테이블 + 페이지네이션 + CSV (URL state)
   UsersTableClient 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { exportNewsletterSubscribersXlsxAction } from './actions';
import { downloadXlsxFromBase64 } from '@/lib/admin/clientDownload';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/admin/ui/button';
import {
  NEWSLETTER_PAGE_SIZE,
  NEWSLETTER_SOURCE_LABEL,
  type NewsletterSearchParams,
  type NewsletterStatusTab,
} from '@/lib/admin/newsletter';
import type { NewsletterSubscriberRow } from '@/lib/admin/newsletterServer';

type Props = {
  rows: NewsletterSubscriberRow[];
  total: number;
  counts: Record<NewsletterStatusTab, number>;
  filters: NewsletterSearchParams;
  /** CSV 내보내기는 owner 전용 (PII). staff 는 disabled. */
  isOwner: boolean;
};

type Section = 'subscribers' | 'send' | 'history';

const STATUS_TABS: { id: NewsletterStatusTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '활성' },
  { id: 'unsubscribed', label: '거부' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function describeRange(page: number, total: number): string {
  if (total === 0) return '0건';
  const from = (page - 1) * NEWSLETTER_PAGE_SIZE + 1;
  const to = Math.min(page * NEWSLETTER_PAGE_SIZE, total);
  return `총 ${total.toLocaleString()}건 · ${from}–${to}번째`;
}

export default function NewsletterClient({ rows, total, counts, filters, isOwner }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>('subscribers');
  const [searchValue, setSearchValue] = useState(filters.q);
  const [isExporting, startExport] = useTransition();

  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  /* URL builder — 현재 filters + override (구독자 패널 전용) */
  function buildHref(override: Partial<NewsletterSearchParams>): string {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.status !== 'all') params.set('status', merged.status);
    if (merged.q.trim().length > 0) params.set('q', merged.q.trim());
    if (merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    return qs.length > 0 ? `?${qs}` : '?';
  }

  /* 검색 — 300ms debounced router.replace */
  useEffect(() => {
    if (searchValue === filters.q) return;
    const t = setTimeout(() => {
      router.replace(buildHref({ q: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function handleExport() {
    startExport(async () => {
      const result = await exportNewsletterSubscribersXlsxAction({
        status: filters.status,
        q: filters.q,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          unauthorized: '권한이 없습니다.',
          validation_failed: '입력값이 잘못되었습니다.',
          server_error: '내보내는 중 오류가 발생했습니다.',
        };
        toast.error(map[result.error] ?? '오류가 발생했습니다.');
        return;
      }
      if (result.rowCount === 0) {
        toast.info('내보낼 구독자가 없습니다.');
        return;
      }
      downloadXlsxFromBase64(result.xlsxBase64, result.filename);
      if (result.truncated) {
        toast.warning(
          `${result.rowCount.toLocaleString()}건 내보냈습니다. 상한(10,000건) 초과 — 필터를 좁혀 다시 내보내주세요.`,
        );
      } else {
        toast.success(`${result.rowCount.toLocaleString()}건을 내보냈습니다.`);
      }
    });
  }

  const pageCount = Math.max(1, Math.ceil(total / NEWSLETTER_PAGE_SIZE));

  const columns: readonly Column<NewsletterSubscriberRow>[] = useMemo(
    () => [
      { key: 'email', header: '이메일', cellClassName: 'text-sm', render: (r) => r.email },
      {
        key: 'name',
        header: '이름',
        cellClassName: 'text-sm text-muted-foreground',
        render: (r) => r.userName ?? (r.userId ? '—' : <span className="italic">비회원</span>),
      },
      {
        key: 'status',
        header: '상태',
        render: (r) =>
          r.status === 'active' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
              활성
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">
              거부
            </span>
          ),
      },
      {
        key: 'source',
        header: '유입',
        cellClassName: 'text-xs text-muted-foreground',
        render: (r) => NEWSLETTER_SOURCE_LABEL[r.source] ?? r.source,
      },
      {
        key: 'createdAt',
        header: '가입일',
        cellClassName: 'text-xs text-muted-foreground tabular-nums',
        render: (r) => formatDate(r.createdAtIso),
      },
    ],
    [],
  );

  const sectionTabs = [
    { id: 'subscribers', label: '구독자', count: counts.all },
    { id: 'send', label: '발송' },
    { id: 'history', label: '발송 이력' },
  ];

  return (
    <>
      {section === 'subscribers' && (
        <AdminTopbarActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7"
            onClick={handleExport}
            disabled={!isOwner || isExporting || total === 0}
            title={!isOwner ? '관리자 권한 필요' : '현재 필터 기준으로 Excel 내보내기'}
          >
            <Download />
            {isExporting ? '내보내는 중…' : 'Excel 내보내기'}
          </Button>
        </AdminTopbarActions>
      )}

      <AdminPageHeader
        title="뉴스레터"
        subtitle={
          <>
            구독자 {counts.all.toLocaleString()}명 · 활성 {counts.active.toLocaleString()} · 거부{' '}
            {counts.unsubscribed.toLocaleString()}
          </>
        }
      />

      {/* 섹션 탭 — 구독자 / 발송 / 발송 이력 (발송·이력 = Phase 2) */}
      <AdminTabsNav
        mode="state"
        tabs={sectionTabs}
        active={section}
        onChange={(id) => setSection(id as Section)}
      />

      {section === 'subscribers' ? (
        <>
          {/* 상태 필터 탭 */}
          <AdminTabsNav
            mode="url"
            tabs={STATUS_TABS.map((t) => ({
              id: t.id,
              label: t.label,
              count: counts[t.id] ?? 0,
            }))}
            active={filters.status}
            buildHref={(id) => buildHref({ status: id as NewsletterStatusTab, page: 1 })}
          />

          <div className="flex gap-2 mb-3 items-center">
            <AdminSearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="이메일로 검색…"
            />
          </div>

          <AdminDataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            empty={
              <AdminEmptyState
                variant="table-row"
                colSpan={columns.length}
                message="구독자가 없습니다."
              />
            }
            footer={
              <>
                <div>{describeRange(filters.page, total)}</div>
                <AdminPagination
                  mode="url"
                  page={filters.page}
                  pageCount={pageCount}
                  buildHref={(p) => buildHref({ page: p })}
                />
              </>
            }
          />
        </>
      ) : (
        <div className="border border-border rounded-md bg-card px-4 py-16 text-center text-muted-foreground text-sm">
          {section === 'send' ? '뉴스레터 발송' : '발송 이력'} 기능은 준비 중입니다.
        </div>
      )}
    </>
  );
}
