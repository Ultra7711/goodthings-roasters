# CSS Usage Audit — S262 Phase 0

- Total unique classes: **781**
- A (used): 757
- B (likely dead): 5
- C (suspect — dynamic prefix): 10
- L (external library — audit 제외): 9

## B (likely dead · first 200)

| class | css_files |
|---|---|
| `cm-badge-temp` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-badges` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-hot-only` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-ice-only` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-warm` | src/components/cafe/CafeMenuPage.css |

## C (suspect · 10)

| class | dynamic_prefix_hits | css_files |
|---|---|---|
| `cm-meta-badge--rank-1` | 1 | src/components/cafe/CafeMenuPage.css |
| `cm-meta-badge--rank-2` | 1 | src/components/cafe/CafeMenuPage.css |
| `cm-meta-badge--rank-3` | 1 | src/components/cafe/CafeMenuPage.css |
| `cns-temp-pill--hot` | 1 | src/components/cafe/CafeMenuPage.css |
| `cns-temp-pill--ice` | 1 | src/components/cafe/CafeMenuPage.css |
| `cns-temp-pill--warm` | 1 | src/components/cafe/CafeMenuPage.css |
| `gd-tap-flash--next` | 1 | src/components/gooddays/GoodDaysPage.css |
| `gd-tap-flash--prev` | 1 | src/components/gooddays/GoodDaysPage.css |
| `lineup-grid--bean` | 1 | src/components/home/HomePage.css |
| `lineup-grid--drip` | 1 | src/components/home/HomePage.css |