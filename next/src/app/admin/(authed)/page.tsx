/* ══════════════════════════════════════════
   Admin Dashboard (/admin) — Claude Design 핸드오프 적용.
   - 환영 헤더 + 4 stat cards + 최근 주문 테이블 + 사이드 위젯 (할 일·베스트셀러)
   - 데이터는 모두 placeholder (실데이터 연결은 Group I).
   ══════════════════════════════════════════ */

import { ChevronRight, Plus, Download } from 'lucide-react';
import { Card } from '@/components/admin/ui/card';
import { Button } from '@/components/admin/ui/button';
import { Badge } from '@/components/admin/ui/badge';
import StatCard from '@/components/admin/StatCard';

const STATS = [
  {
    label: '오늘 주문',
    value: '—',
    sub: 'Group I-1 에서 채워질 예정',
    accent: true,
  },
  {
    label: '이번 주 매출',
    value: '—',
    sub: 'Group I-1 에서 채워질 예정',
  },
  {
    label: '활성 정기배송',
    value: '—',
    sub: 'Group I-1 에서 채워질 예정',
  },
  {
    label: '대기 주문',
    value: '—',
    sub: 'Group I-1 에서 채워질 예정',
    warn: true,
  },
] as const;

const TASKS = [
  { label: '신규 주문 처리', count: 0, tone: 'primary' as const },
  { label: '로스팅 일정 확정', count: 0, tone: 'warning' as const },
  { label: '재고 알림', count: 0, tone: 'destructive' as const },
  { label: '발송 대기', count: 0, tone: 'info' as const },
];

const BESTSELLERS = [
  { name: '에티오피아 예가체프 · 200g', count: 0, max: 1 },
  { name: '하우스 블렌드 · 500g', count: 0, max: 1 },
  { name: '콜롬비아 핑크버번', count: 0, max: 1 },
  { name: '드립백 선물세트', count: 0, max: 1 },
];

const TODAY_LABEL = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());

export default function AdminDashboardPage() {
  return (
    <div>
      {/* 환영 헤더 */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-3">
            <h2
              className="gtr-serif m-0 text-[28px] font-medium"
              style={{ letterSpacing: '-0.02em' }}
            >
              안녕하세요
            </h2>
            <span className="text-[13px]" style={{ color: 'var(--foreground-muted)' }}>
              {TODAY_LABEL}
            </span>
          </div>
          <div className="text-[13px]" style={{ color: 'var(--foreground-muted)' }}>
            어드민 콘솔 인프라 구축 단계입니다. 실데이터는 Group I 통계 그룹에서 연결됩니다.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Download className="size-3.5" />
            리포트 내보내기
          </Button>
          <Button size="sm" disabled>
            <Plus className="size-3.5" />
            주문 생성
          </Button>
        </div>
      </div>

      {/* 통계 그리드 */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {STATS.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            sub={s.sub}
            accent={'accent' in s ? s.accent : false}
            warn={'warn' in s ? s.warn : false}
          />
        ))}
      </div>

      {/* 메인 그리드 — 최근 주문 + 사이드 위젯 */}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* 최근 주문 */}
        <Card className="gap-0 p-0">
          <div
            className="flex items-center justify-between px-[18px] py-3.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <h3 className="gtr-serif m-0 text-[15px] font-medium">최근 주문</h3>
              <Badge variant="outline" className="text-[11px]">
                Group B 구현 예정
              </Badge>
            </div>
            <span
              className="flex cursor-pointer items-center gap-0.5 text-[12px]"
              style={{ color: 'var(--foreground-muted)' }}
            >
              전체 보기 <ChevronRight size={14} />
            </span>
          </div>
          <div
            className="px-[18px] py-12 text-center text-[13px]"
            style={{ color: 'var(--foreground-muted)' }}
          >
            주문 데이터가 연결되면 최근 5건이 여기에 표시됩니다.
          </div>
        </Card>

        {/* 사이드 위젯 */}
        <div className="flex flex-col gap-3">
          <Card className="p-[18px]">
            <h3 className="gtr-serif m-0 text-[15px] font-medium">오늘 할 일</h3>
            <div className="mt-3 flex flex-col gap-2.5">
              {TASKS.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span>{t.label}</span>
                  <Badge variant="secondary" className="gtr-tnum">
                    {t.count}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-[18px]">
            <h3 className="gtr-serif m-0 text-[15px] font-medium">이번 주 베스트셀러</h3>
            <div className="mt-3 flex flex-col gap-2.5">
              {BESTSELLERS.map((b) => (
                <div key={b.name} className="text-[12.5px]">
                  <div className="mb-1 flex justify-between">
                    <span>{b.name}</span>
                    <span
                      className="gtr-tnum"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {b.count}건
                    </span>
                  </div>
                  <div
                    className="h-1 overflow-hidden rounded"
                    style={{ background: 'var(--surface-muted)' }}
                  >
                    <div
                      className="h-full opacity-80"
                      style={{
                        width: `${(b.count / b.max) * 100}%`,
                        background: 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
