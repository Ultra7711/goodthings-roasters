/* ══════════════════════════════════════════
   MyPageSkeleton
   /mypage 진입 시 Suspense fallback 으로 사용.
   서버 인증(`requireAuth`) + 클라 hydration 동안 보여지는 skeleton.

   설계 (BUG-168):
   - 헤더 + 좌우 그리드를 즉시 표시 → "헤더도 안 보이는 백지" 제거
   - 고정 섹션(계정 정보·계정 관리)은 정확한 placeholder → swap 시 layout shift 없음
   - 가변 섹션(정기배송·주문 내역)은 1개 카드만 표시 → 실데이터 N개와 차이 작음
   - SkelBox 높이는 실제 텍스트 line-height 기준 (body-m=22, body-ui=16)
   - mp-section-body 내 padding 은 실제 컴포넌트 매칭 (mp-info-row=14, mp-sub-item=16, mp-order-card=20)

   헤더: SiteHeader 직접 사용 (메인 라우트와 픽셀 단위 동일 → swap 시 헤더 layout shift 0)
   ══════════════════════════════════════════ */

import SiteHeader from '@/components/layout/SiteHeader';

/* 텍스트 line-height 기준 placeholder 높이 (px) */
const H_BODY_M = 22; /* var(--type-body-m-size)=15px × 1.5 ≈ 22.5 */
const H_BODY_UI = 16; /* 작은 보조 텍스트 (date·status·vol) */

type BoxProps = {
  height: number;
  width?: number | string;
};

function SkelBox({ height, width = '100%' }: BoxProps) {
  return <div className="skel" style={{ height, width }} />;
}

function InfoRowSkel({ labelW = 80, valueW = 200 }: { labelW?: number; valueW?: number }) {
  return (
    <div className="mp-info-row">
      <SkelBox height={H_BODY_M} width={labelW} />
      <SkelBox height={H_BODY_M} width={valueW} />
    </div>
  );
}

export default function MyPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      <SiteHeader />

      {/* 본문 — 실제 mp-body 와 동일 그리드 */}
      <div className="mp-body">
        {/* ══ 좌측 ══ */}
        <div className="mp-left">
          <div className="mp-title-row">
            <div className="mp-page-title">마이 페이지</div>
          </div>
          <div className="mp-welcome-wrap">
            <SkelBox height={H_BODY_M} width={220} />
          </div>

          {/* 계정 정보 — 고정 (이름·이메일·주소 3행) */}
          <div className="mp-section">
            <h2 className="mp-section-title">계정 정보</h2>
            <div className="mp-section-body">
              <InfoRowSkel labelW={48} valueW={160} />
              <InfoRowSkel labelW={48} valueW={220} />
              <InfoRowSkel labelW={80} valueW={280} />
            </div>
          </div>

          {/* 정기배송 관리 — 가변 (1개 카드 placeholder · mp-sub-item padding 16) */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">정기배송 관리</h2>
            <div className="mp-section-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 0' }}>
                <SkelBox height={H_BODY_M} width="60%" />
                <SkelBox height={H_BODY_UI} width="40%" />
              </div>
            </div>
          </div>

          {/* 계정 관리 — 고정 (비밀번호 변경·회원 탈퇴 2행) */}
          <div className="mp-section mp-section--no-border">
            <h2 className="mp-section-title">계정 관리</h2>
            <div className="mp-section-body">
              <InfoRowSkel labelW={120} valueW={24} />
              <InfoRowSkel labelW={80} valueW={24} />
            </div>
          </div>
        </div>

        {/* ══ 우측 — 주문 내역 (가변, 1개 카드 placeholder · mp-order-card padding 20) ══ */}
        <div className="mp-right">
          <h2 className="mp-section-title">주문 내역</h2>
          <div className="mp-section-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkelBox height={H_BODY_UI} width={80} />
                <SkelBox height={H_BODY_UI} width={60} />
              </div>
              <SkelBox height={H_BODY_M} width="70%" />
              <SkelBox height={H_BODY_M} width={100} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
