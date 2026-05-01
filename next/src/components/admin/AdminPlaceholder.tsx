/* ══════════════════════════════════════════
   AdminPlaceholder — 미구현 그룹 페이지 빈 상태.
   - Claude Design 핸드오프 (empty.jsx) 기반.
   - 일러스트 (스타일라이즈드 차트) + 헤딩 + 설명 + 그룹 안내.
   ══════════════════════════════════════════ */

import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/admin/ui/card';

type Props = {
  title: string;
  description: string;
  group: string;
};

export default function AdminPlaceholder({ title, description, group }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h2
          className="gtr-serif m-0 text-[24px] font-medium"
          style={{ letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
        <div
          className="mt-1 text-[13px]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {description}
        </div>
      </div>

      <Card className="gap-0 p-0">
        <div className="relative flex flex-col items-center overflow-hidden px-6 py-16 text-center">
          {/* faint grid backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />

          {/* 일러스트 — 스타일라이즈드 차트 카드 */}
          <div
            className="relative mb-5 flex items-end gap-2 px-3.5 py-3.5"
            style={{
              width: 120,
              height: 90,
              borderRadius: 8,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            {[14, 26, 18, 32, 22].map((h, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: h,
                  borderRadius: 2,
                  background:
                    i === 3 ? 'var(--primary)' : 'var(--border-strong)',
                  opacity: i === 3 ? 0.9 : 0.6,
                }}
              />
            ))}
            <div
              className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                border: '1.5px solid var(--card)',
              }}
            >
              <BarChart3 size={14} />
            </div>
          </div>

          <h3
            className="gtr-serif relative m-0 text-[20px] font-medium"
            style={{ letterSpacing: '-0.015em' }}
          >
            구현 예정 — {title}
          </h3>
          <p
            className="relative m-0 mt-2 max-w-[420px] text-[13.5px]"
            style={{ color: 'var(--foreground-muted)', lineHeight: 1.7 }}
          >
            이 페이지는 어드민 인프라(Group A) 구축 단계 placeholder 입니다.{' '}
            <strong style={{ color: 'var(--foreground)' }}>Group {group}</strong>{' '}
            그룹 작업 시 실제 기능과 데이터로 채워집니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
