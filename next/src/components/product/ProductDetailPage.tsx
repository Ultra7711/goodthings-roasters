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

import { type CSSProperties, useEffect, useRef, useState } from 'react';
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

  /* PR-2a (S156 D안): 우측 #pd-info 의 padding-bottom 을 좌측 yarl 썸네일 트랙 height 만큼 부여.
     썸네일 있을 때만 96px (= --pd-yarl-thumbs-h 동일값) 로 PurchaseRow 의 CTA baseline 을
     메인 이미지 하단(=100cqw) 에 정렬. 썸네일 없으면 0 → 자연 흐름.
     데스크탑 1024+ 에서만 globals.css 가 var() 를 read 한다. */
  const hasThumbs = product.images.length > 1;
  const contentStyle = { '--pd-thumbs-h': hasThumbs ? '96px' : '0px' } as CSSProperties;

  return (
    <div id="pd-body" ref={pageRef}>
      <div id="pd-inner">
        {/* ① Hero — 좌: sticky 이미지 / 우: 정보 + 옵션 + CTA (V2 §5.2)
            sticky 동작 범위: #pd-content 안에서만 — 풀폭 ②③④ chapter 위로 따라오지 않음
            (specialty coffee 외부 표준 검증: Drop Coffee · 프릳츠 · 커피리브레 모두 풀폭 chapter sticky 패턴 사용 X) */}
        <div id="pd-content" style={contentStyle}>
          <div id="pd-img-col">
            <div id="pd-img-wrap">
              <ProductGallery images={product.images} status={product.status} />
            </div>
          </div>

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
            <PurchaseRow
              product={product}
              volIdx={volIdx}
              onVolChange={setVolIdx}
            />
          </div>
        </div>

        {/* ② Tasting — Roasting + Flavor 묶음 (V2 §5.3 · PR-2b S157 + 후속)
            sand 패널 + 2-col split. 1024+: Roasting col 1 / Flavor col 2 row span 2 / 면책 col 1 row 2 (좌측 끝, Flavor 끝과 baseline).
            1023↓: 1-col stacking — Roasting → Flavor → 면책 (chapter 끝). chapter header 는 PR-2c carry-over. */}
        <section className="pd-chapter pd-chapter-tasting">
          <ProductRoastStage roastStage={product.roastStage} />
          <ProductFlavorNote
            note={product.note}
            noteTags={product.noteTags}
            noteColor={product.noteColor}
          />
          <p className="pd-tasting-disclaimer">
            큐그레이더 평가가 아닌 시음 메모로, 상대 비교 참고용입니다.
          </p>
        </section>

        {/* ③ Brewing — 4 도구 카드 (원두) / 3 단계 (드립백) (V2 §5.4) */}
        <section className="pd-chapter pd-chapter-brewing">
          {product.category === 'Drip Bag' ? <DripBagSteps /> : <ProductRecipeGuide product={product} />}
        </section>

        {/* ④ Detail — 아코디언 + SpecTable (V2 §5.5) */}
        <section className="pd-chapter pd-chapter-detail">
          <ProductAccordions category={product.category} slug={product.slug} />
        </section>
      </div>
    </div>
  );
}
