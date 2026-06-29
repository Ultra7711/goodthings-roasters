/* ══════════════════════════════════════════
   MyPageSkeleton — V2 §3 신구조 (S264 H-1 갱신)
   /mypage Suspense fallback. requireAuth + hydration 동안 노출.

   설계 원칙 (S253 · S264 H-1):
   - 실제 컴포넌트 layout 1:1 답습 → swap 시 layout shift 최소화
   - HeroGreeting: h1 2 줄 + meta row (실제 안녕하세요. / {name} 님)
   - Hero card 제거 (S264 H-1) — Hero Card 분기 폐기, hero-wrap 풀블리드 sand 만 보유
   - OrderHistory: mp-order-card × 3 stack (hairline border + meta/content row)
   - mp-side-nav: 4 항목

   CSS 명시 import — Skeleton 은 server component 라 client chunk 의 css 가
   fallback 시점에 일부 미로딩 가능 (sand 카드 width 단차 발생). 같은 css 를
   여기서 명시 import 하여 fallback chunk 에 포함 → 단차 차단.
   ══════════════════════════════════════════ */

import './MyPagePage.css';
import '@/components/ui/PageTitle.css';
import '@/components/auth/mypage/HeroGreeting.css';
import '@/components/auth/mypage/MyPageSideNav.css';
import '@/components/auth/mypage/MyPagePanel.css';

/* placeholder height — line-height 토큰 활용 (viewport 분기 자동 정합). */
const H_PAGE_TITLE = 'var(--lh-h1)';
const H_BODY_L = 28;
const H_BODY_M = 24;
const H_BODY_S = 20;

type BoxProps = {
  height: number | string;
  width?: number | string;
};

function SkelBox({ height, width = '100%' }: BoxProps) {
  return <div className="skel" style={{ height, width }} />;
}

/* OrderHistory mp-order-card 1개 답습.
   .mp-order-card padding: 20 0 + hairline border-bottom.
   내부: meta(date + number + status) + content(summary/detail + chevron).
   S282-P1 (variant): 카드 다양성 답습 — orders 마다 status 배지 폭 / summary 폭 / detail 유무 차이.
   동일 3개 stack 폐기 → 실제 카드 다양성 1:1 답습으로 swap 시 layout shift ↓. */
type CardVariant = {
  summaryW: string;
};

/* 중입자: 날짜·주문번호(meta 2줄) + 요약 1줄. 상태배지·셰브론·상세 등
   미세요소는 박스화 생략. 카드 padding(20 0) + hairline 은 유지 → 높이 보존. */
function OrderCardSkeleton({
  isLast = false,
  variant,
}: {
  isLast?: boolean;
  variant: CardVariant;
}) {
  return (
    <div
      style={{
        padding: '20px 0',
        boxShadow: isLast ? 'none' : 'inset 0 -1px 0 0 var(--color-border-hairline)',
      }}
    >
      {/* meta: 날짜 + 주문번호 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SkelBox height={H_BODY_S} width={90} />
        <SkelBox height={H_BODY_M} width={140} />
      </div>
      {/* 요약 1줄 */}
      <div style={{ marginTop: 12 }}>
        <SkelBox height={H_BODY_M} width={variant.summaryW} />
      </div>
    </div>
  );
}

/* 주문별 요약 폭 다양성만 답습 (단일 상품 vs "외 N건"). */
const CARD_VARIANTS: readonly CardVariant[] = [
  { summaryW: '60%' },
  { summaryW: '40%' },
  { summaryW: '75%' },
] as const;

export default function MyPageSkeleton() {
  return (
    <div className="mp-page is-loaded">
      {/* Hero 풀블리드 영역 placeholder — mp-body 외부 sibling (viewport 풀폭 sand) */}
      <div className="mp-hero-wrap">
        <div className="mp-hero-inner">
          <header className="page-title-area mp-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <SkelBox height={H_PAGE_TITLE} width={140} />
              <SkelBox height={H_PAGE_TITLE} width={180} />
            </div>
            <div className="mp-hero-meta-row">
              <SkelBox height={H_BODY_L} width={200} />
              <SkelBox height={H_BODY_L} width={64} />
            </div>
          </header>
        </div>
      </div>

      {/* mp-body: max-width centered + padding · 내부 mp-grid */}
      <div className="mp-body">
        <div className="mp-grid">
          <nav className="mp-side-nav" aria-hidden="true">
            <ul className="mp-side-nav-list">
              {[
                { labelW: 64, hasCount: true },   // 주문내역 (4글자)
                { labelW: 64, hasCount: true },   // 정기배송 (4글자)
                { labelW: 48, hasCount: false },  // 프로필 (3글자)
                { labelW: 64, hasCount: false },  // 계정관리 (4글자)
              ].map((it, i) => (
                <li key={i}>
                  <div className="mp-side-nav-item" style={{ pointerEvents: 'none' }}>
                    <SkelBox height={H_BODY_L} width={it.labelW} />
                    {it.hasCount && <SkelBox height={H_BODY_S} width={16} />}
                  </div>
                </li>
              ))}
            </ul>
          </nav>

          {/* Panel placeholder — sub-title h2 + OrderHistory mp-order-card × 3 stack */}
          <div className="mp-panel">
            <div style={{ marginBottom: 24 }}>
              <SkelBox height={28} width={120} />
            </div>
            <div className="mp-section-body">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {CARD_VARIANTS.map((v, i) => (
                  <OrderCardSkeleton
                    key={i}
                    variant={v}
                    isLast={i === CARD_VARIANTS.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
