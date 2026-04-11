/* ══════════════════════════════════════════
   ProductDetailPage — RP-4a 뼈대
   ──────────────────────────────────────────
   프로토타입 #product-detail-page 를 Next.js 라우트(/shop/[slug])로 이식.
   프로토타입의 position:fixed sub-page 구조는 Next 라우팅에 불필요하므로
   일반 플로우 컨테이너로 치환 (#sp-body 패턴 참고).

   RP-4a 범위:
     - 라우트 + 데이터 바인딩
     - 2단 그리드 레이아웃 껍데기 (#pd-content)
     - 진입 애니메이션 (pd-anim) — ShopPage sp-anim 과 동일한 reflow 패턴
     - 좌: 이미지 placeholder (#pd-img-wrap > #pd-img)
     - 우: 카테고리/이름/상태/구분선 (#pd-info 상단)
     - 하단 섹션은 후속 Phase(RP-4b~e)에서 채움
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import { type Product, splitName, getStatusBadgeClass } from '@/lib/products';
import ProductGallery from './ProductGallery';
import PurchaseRow from './PurchaseRow';
import ProductDetailBody from './ProductDetailBody';
import ProductRoastStage from './ProductRoastStage';
import ProductFlavorNote from './ProductFlavorNote';
import ProductRecipeGuide from './ProductRecipeGuide';
import ProductAccordions from './ProductAccordions';

function formatPrice(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

type Props = { product: Product };

export default function ProductDetailPage({ product }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);

  /* 용량 선택 상태 — PurchaseRow 와 공유하여 #pd-price 실시간 갱신.
     수량에는 반응하지 않고 선택된 용량의 단가만 표시한다. */
  const [volIdx, setVolIdx] = useState(0);
  const hasVolumes = product.volumes.length > 0;
  /* 상품 전체 매진 판정 — status === '매진' 이거나 모든 볼륨이 soldOut.
     매진 상품에서는 가격 노출을 차단해 "구매 가능" 처럼 보이지 않게 한다. */
  const allSoldOut = hasVolumes && product.volumes.every((v) => v.soldOut);
  const isSoldOut = product.status === '매진' || allSoldOut;

  /* 진입 애니메이션 — ShopPage sp-anim 과 동일한 reflow 패턴.
     className remove → 강제 reflow(offsetHeight read) → add 순으로
     브라우저가 초기 상태를 한 번 paint 한 뒤 transition 을 재생한다. */
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.classList.remove('pd-anim');
    void el.offsetHeight;
    el.classList.add('pd-anim');
  }, [product.slug]);

  /* 상품 변경 시 용량 선택 초기화 — 첫 번째 가용(매진 아닌) 볼륨을 선택.
     전체 매진이면 0 으로 고정 (상품 전체 disabled 상태).
     product prop 변경 시 내부 파생 state 동기화 의도의 setState-in-effect. */
  useEffect(() => {
    const firstAvail = product.volumes.findIndex((v) => !v.soldOut);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVolIdx(firstAvail >= 0 ? firstAvail : 0);
  }, [product.slug, product.volumes]);

  const { kr, en } = splitName(product.name);
  const unitPrice = hasVolumes ? product.volumes[volIdx].price : 0;
  /* 매진 상품은 가격 숨김 — 뱃지와 CTA 로만 상태 전달. */
  const showPrice = hasVolumes && !isSoldOut;

  return (
    <div id="pd-body" ref={pageRef}>
      <div id="pd-inner">
        <div id="pd-content">
          {/* ── 좌: 이미지 갤러리 + 배송/교환반품 아코디언 ── */}
          <div id="pd-img-wrap">
            <ProductGallery images={product.images} />
            <ProductAccordions category={product.category} slug={product.slug} />
          </div>

          {/* ── 우: 상품 정보 (RP-4c~e 에서 구매행/로스팅/노트/아코디언 추가) ── */}
          <div id="pd-info">
            <div id="pd-category">{product.category}</div>
            <div id="pd-name">
              <span className="pd-name-kr">{kr}</span>
              {en && <span className="pd-name-en">{en}</span>}
            </div>
            {showPrice && <div id="pd-price">{formatPrice(unitPrice)}</div>}
            {product.status && (
              <span id="pd-status">
                <span className={getStatusBadgeClass(product.status)}>{product.status}</span>
              </span>
            )}
            <div id="pd-divider" />

            {/* RP-4c: 구매 옵션 + 장바구니 */}
            <PurchaseRow
              product={product}
              volIdx={volIdx}
              onVolChange={setVolIdx}
            />

            {/* RP-4d: 상세 본문 / 로스팅 / 노트 / 레시피
                (배송/교환반품 아코디언은 좌측 이미지 아래로 이동) */}
            <ProductDetailBody desc={product.desc} specs={product.specs} />
            <ProductRoastStage roastStage={product.roastStage} />
            <ProductFlavorNote
              note={product.note}
              noteTags={product.noteTags}
              noteColor={product.noteColor}
            />
            <ProductRecipeGuide product={product} />
          </div>
        </div>

        {/* Story section 은 RP-4e 에서 구현 */}
      </div>
    </div>
  );
}
