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
import { type Product, splitName } from '@/lib/products';
import ProductGallery from './ProductGallery';
import PurchaseRow from './PurchaseRow';
import ProductRoastStage from './ProductRoastStage';
import ProductFlavorNote from './ProductFlavorNote';
import ProductRecipeGuide from './ProductRecipeGuide';
import DripBagSteps from './DripBagSteps';
import ProductAccordions from './ProductAccordions';

type Props = { product: Product };

export default function ProductDetailPage({ product }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);

  /* 용량 선택 상태 — PurchaseRow 가 chip · 수량 · CTA 가격 합계에 사용.
     ProductDetailPage 에서는 더 이상 단가를 표시하지 않으므로 read 만 동기화. */
  const [volIdx, setVolIdx] = useState(0);

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

  /* 상품 변경 시 용량 선택 초기화 — 첫 번째 가용(품절 아닌) 볼륨을 선택.
     전체 품절이면 0 으로 고정 (상품 전체 disabled 상태).
     product prop 변경 시 내부 파생 state 동기화 의도의 setState-in-effect. */
  useEffect(() => {
    const firstAvail = product.volumes.findIndex((v) => !v.soldOut);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVolIdx(firstAvail >= 0 ? firstAvail : 0);
  }, [product.slug, product.volumes]);

  const { kr, en } = splitName(product.name);
  const descParagraphs = product.desc.trim().split(/\n\n+/).filter(Boolean);

  return (
    <div id="pd-body" ref={pageRef}>
      <div id="pd-inner">
        <div id="pd-content">
          {/* ── 좌: 이미지 갤러리 (sticky) ──
              데스크탑: #pd-img-wrap 이 sticky 로 우측 정보 스크롤 시에도 viewport 고정.
              모바일(≤1023px): position static 으로 일반 흐름.
              아코디언은 우측 #pd-info 마지막 element 로 이동 (PR 3 결정 · V2 §5.2). */}
          <div id="pd-img-col">
            <div id="pd-img-wrap">
              <ProductGallery images={product.images} status={product.status} />
            </div>
          </div>

          {/* ── 우: 상품 정보 — 카테고리 → 이름 → 설명 → 옵션 → 로스팅/노트/레시피 → 아코디언 ── */}
          <div id="pd-info">
            <div id="pd-category">{product.category}</div>
            <div id="pd-name">
              <span className="pd-name-kr">{kr}</span>
              {en && <span className="pd-name-en">{en}</span>}
            </div>
            {descParagraphs.length > 0 && (
              <div id="pd-desc">
                {descParagraphs.map((para, i) => (
                  <p key={i}>
                    {para.split('\n').map((line, j, arr) => (
                      <span key={j}>
                        {line}
                        {j < arr.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            )}
            {/* RP-4c: 구매 옵션 + 장바구니
                (status 뱃지는 좌측 이미지 좌상단으로 이동 — Shop 카드 일관) */}
            <PurchaseRow
              product={product}
              volIdx={volIdx}
              onVolChange={setVolIdx}
            />

            {/* RP-4d: 로스팅 / 노트 / 레시피
                (배송/교환반품 아코디언은 좌측 이미지 아래로 이동) */}
            <ProductRoastStage roastStage={product.roastStage} />
            <ProductFlavorNote
              note={product.note}
              noteTags={product.noteTags}
              noteColor={product.noteColor}
            />
            {product.category === 'Drip Bag' ? <DripBagSteps /> : <ProductRecipeGuide product={product} />}
            <ProductAccordions category={product.category} slug={product.slug} />
          </div>
        </div>

        {/* Story section 은 RP-4e 에서 구현 */}
      </div>
    </div>
  );
}
