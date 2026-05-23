# CSS Usage Audit — S262 Phase 0

- Total unique classes: **840**
- A (used): 757
- B (likely dead): 60
- C (suspect — dynamic prefix): 14
- L (external library — audit 제외): 9

## B (likely dead · first 200)

| class | css_files |
|---|---|
| `bi-check-group` | src/components/biz/BizInquiryPage.css |
| `bi-check-item` | src/components/biz/BizInquiryPage.css |
| `bi-check-label` | src/components/biz/BizInquiryPage.css |
| `bi-check-row` | src/components/biz/BizInquiryPage.css |
| `bi-note-icon` | src/components/biz/BizInquiryPage.css |
| `blk--bg-warm` | src/app/globals.css |
| `blk-header` | src/components/home/HomePage.css |
| `blk-heading` | src/components/home/HomePage.css |
| `cat-arrow` | src/app/globals.css<br>src/components/home/HomePage.css |
| `cat-card` | src/app/globals.css<br>src/components/home/HomePage.css |
| `cat-card-clip` | src/components/home/HomePage.css |
| `cat-desc` | src/components/home/HomePage.css |
| `cat-grid` | src/app/globals.css<br>src/components/home/HomePage.css |
| `cat-img` | src/app/globals.css<br>src/components/home/HomePage.css |
| `cat-img-inner` | src/app/globals.css<br>src/components/home/HomePage.css |
| `cat-overlay` | src/components/home/HomePage.css |
| `cat-title` | src/components/home/HomePage.css |
| `chp-coupon-arrow` | src/app/globals.css |
| `chp-coupon-row` | src/app/globals.css |
| `chp-dropdown-list` | src/app/globals.css |
| `chp-dropdown-option` | src/app/globals.css |
| `chp-dropdown-value` | src/app/globals.css |
| `chp-error-msg` | src/app/globals.css |
| `chp-field-row` | src/app/globals.css |
| `chp-link` | src/app/globals.css |
| `cm-badge-temp` | src/components/cafe/CafeMenuPage.css |
| `cm-meta-badge--signature` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-badges` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-hot-only` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-ice-only` | src/components/cafe/CafeMenuPage.css |
| `cm-temp-warm` | src/components/cafe/CafeMenuPage.css |
| `cns-title-badge` | src/components/cafe/CafeMenuPage.css |
| `ed-h2` | src/components/home/HomePage.css |
| `gtr-admin-progress-indet` | src/app/admin/admin-theme.css |
| `gtr-hairline` | src/app/admin/admin-theme.css |
| `lp-demo-fill-btn` | src/components/auth/LoginPage.css |
| `lp-guest-buy-box` | src/components/auth/LoginPage.css |
| `lp-guest-buy-btn` | src/app/globals.css<br>src/components/auth/LoginPage.css |
| `lp-guest-buy-desc` | src/components/auth/LoginPage.css |
| `mp-addr-empty` | src/components/auth/MyPagePage.css |
| `mp-section-title` | src/components/auth/MyPagePage.css |
| `mp-sub-unsubscribe` | src/components/auth/MyPagePage.css |
| `ocp-copy-btn` | src/components/checkout/OrderCompletePage.css |
| `ocp-email-notice` | src/components/checkout/OrderCompletePage.css |
| `ocp-eyebrow` | src/components/checkout/OrderCompletePage.css |
| `ocp-order-num` | src/components/checkout/OrderCompletePage.css |
| `ocp-temp-fallback` | src/components/checkout/OrderCompletePage.css |
| `pd-drip-icon-item` | src/components/product/ProductDetailPage.css |
| `pd-drip-icons` | src/components/product/ProductDetailPage.css |
| `pd-drip-step-num` | src/components/product/ProductDetailPage.css |
| `pd-drip-step-text` | src/components/product/ProductDetailPage.css |
| `pd-dropdown-option-soldout` | src/components/product/ProductDetailPage.css |
| `pd-info-section` | src/components/product/ProductDetailPage.css |
| `pd-input-box-trigger` | src/components/product/ProductDetailPage.css |
| `pd-section-intro` | src/components/product/ProductDetailPage.css |
| `pd-section-title` | src/components/product/ProductDetailPage.css |
| `pd-sub-cycle-preview` | src/components/product/ProductDetailPage.css |
| `search-clear-btn` | src/components/search/SearchPage.css |
| `search-input-row` | src/components/search/SearchPage.css |
| `section-cta` | src/app/globals.css |

## C (suspect · 14)

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
| `img-beverage` | 1 | src/components/home/HomePage.css |
| `img-coffee` | 1 | src/components/home/HomePage.css |
| `img-dessert` | 1 | src/components/home/HomePage.css |
| `lineup-grid--bean` | 1 | src/components/home/HomePage.css |
| `lineup-grid--drip` | 1 | src/components/home/HomePage.css |
| `st-map-overlay-close` | 1 | src/components/story/StoryPage.css |