/* ══════════════════════════════════════════
   SearchEmpty
   - hasQuery=false: 입력 대기 안내 (프로토타입 SRP 진입 직후 상태)
   - hasQuery=true & no results: "검색 결과가 없습니다" + 쿼리 표시
   ══════════════════════════════════════════ */

type Props = {
  query: string;
  hasQuery: boolean;
};

export default function SearchEmpty({ query, hasQuery }: Props) {
  if (!hasQuery) {
    return (
      <div className="search-no-results">
        검색어를 입력해 주세요.
        <div className="search-no-results-hint">상품명, 카테고리, 노트 태그 등으로 검색할 수 있어요.</div>
      </div>
    );
  }
  return (
    <div className="search-no-results">
      <strong>&ldquo;{query}&rdquo;</strong>에 대한 검색 결과가 없습니다.
      <div className="search-no-results-hint">다른 검색어로 시도해 보세요.</div>
    </div>
  );
}
