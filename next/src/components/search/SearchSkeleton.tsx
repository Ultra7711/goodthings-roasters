/* ══════════════════════════════════════════
   SearchSkeleton — /search Suspense fallback (S94)

   실제 CSS 클래스 재사용 → 반응형 자동 적용:
   - .search-page-wrap / .search-page-inner (패딩·레이아웃)
   - .search-results-list (목록 구조)
   - .search-result-item (height 176px 데스크탑 / auto 모바일 · 구분선 ::after)
   - .search-result-thumb (100×100 고정 박스)
   - .search-result-info (flex column · gap)
   ══════════════════════════════════════════ */

const RESULT_COUNT = 5;

function SearchSkeletonItem() {
  return (
    <li>
      <div className="search-result-item" style={{ pointerEvents: 'none' }}>
        <div className="search-result-thumb">
          <div className="skel" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
        </div>
        <div className="search-result-info">
          {/* 카테고리: body-s ≈13px */}
          <div className="skel" style={{ height: 14, width: 60 }} />
          {/* 상품명: heading-m ≈20px */}
          <div className="skel" style={{ height: 22, width: 200 }} />
          {/* 가격: body-m ≈15px */}
          <div className="skel" style={{ height: 16, width: 90 }} />
        </div>
      </div>
    </li>
  );
}

export default function SearchSkeleton() {
  return (
    <div className="search-page-wrap">
      <div className="search-page-inner">
        <ul
          className="search-results-list"
          role="list"
          style={{ margin: 0, padding: 0, listStyle: 'none' }}
        >
          {Array.from({ length: RESULT_COUNT }).map((_, i) => (
            <SearchSkeletonItem key={i} />
          ))}
        </ul>
      </div>
    </div>
  );
}
