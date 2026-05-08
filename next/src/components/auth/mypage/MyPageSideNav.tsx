/* ══════════════════════════════════════════
   MyPageSideNav — V2 §3.2 데스크탑 좌측 sub-nav (S197 PR-2)
   PR-2 §2.7: nav 4 재구성 — 단일 주소 정책으로 '주소록' 제거 → 프로필 sub-section 으로 이관.
   비밀번호 변경은 프로필 → 계정관리로 이관.
   - 4 항목: orders / subscription / profile / account
   - 활성 indicator: 좌측 1px ink bar
   - 카운트 badge (선택적)
   - 폭: var(--mp-nav-width) = 220px
   ══════════════════════════════════════════ */

'use client';

import './MyPageSideNav.css';

export type MyPageNavId =
  | 'orders'
  | 'subscription'
  | 'profile'
  | 'account';

type Item = {
  id: MyPageNavId;
  label: string;
  count?: number;
};

type Props = {
  activeId: MyPageNavId;
  counts?: Partial<Record<MyPageNavId, number>>;
  onChange: (id: MyPageNavId) => void;
};

const ITEMS: Omit<Item, 'count'>[] = [
  { id: 'orders', label: '주문내역' },
  { id: 'subscription', label: '정기배송' },
  { id: 'profile', label: '프로필' },
  { id: 'account', label: '계정관리' },
];

export default function MyPageSideNav({ activeId, counts, onChange }: Props) {
  return (
    <nav className="mp-side-nav" aria-label="마이페이지 내비게이션">
      <ul className="mp-side-nav-list">
        {ITEMS.map((item) => {
          const count = counts?.[item.id];
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`mp-side-nav-item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(item.id)}
                data-gtr-tap
              >
                <span className="mp-side-nav-label">{item.label}</span>
                {typeof count === 'number' && count > 0 && (
                  <span className="mp-side-nav-count">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
