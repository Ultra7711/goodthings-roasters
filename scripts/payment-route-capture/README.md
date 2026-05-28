# Toss 결제경로 PPT 자동 캡처

토스페이먼츠 라이브 신청용 "홈페이지 결제경로 제작 가이드" PPT 를 자동 캡처 + 조립.

## 흐름

1. `capture.py` — Playwright (Chromium headed) + PIL.ImageGrab 으로 6단계 캡처
2. `compose.py` — 캡처 PNG 들을 토스 PDF 가이드 순서로 PPT (16:9) 슬라이드 조립
3. 비씨카드 인증 화면 등 자동화 어려운 단계는 interactive prompt 로 사용자 개입

## 설치

```powershell
cd C:\Git\goodthings-roasters\scripts\payment-route-capture
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

## 실행

```powershell
# 1) 표지에 들어갈 테스트 계정 정보 입력
copy cover_info.example.json cover_info.json
# cover_info.json 의 test_id / test_pw / note 채우기

# 2) 캡처 (Chromium 창 자동 띄움)
python capture.py

# 3) 특정 단계부터 재개
python capture.py --step 6

# 4) PPT 조립
python compose.py
# → output/payment-route.pptx
```

## 캡처 단계

| Step | 파일 | 자동 / 수동 |
|------|------|------|
| ② 하단 정보 | `02_footer.png` | 자동 (푸터 토글 클릭) |
| ③ 환불 규정 | `03_refund.png` | 자동 (`/legal/returns`) |
| ④-A 로그인 | `04a_login.png` | 자동 (`/login`) |
| ④-B 회원가입 | `04b_signup.png` | 자동 (로그인 → 회원가입 전환) |
| ④-C 비회원 구매 | `04c_guest_checkout.png` | 자동 (`/checkout` 비회원 분기) |
| ⑤-1 상품 목록 | `05a_shop.png` | 자동 (`/shop`) |
| ⑤-2 상품 상세 | `05b_pdp.png` | 자동 (첫 활성 상품) |
| ⑤-3 장바구니 | `05c_cart.png` | 자동 |
| ⑤-4 주문서 (회원) | `05d_checkout_member.png` | **수동** (사용자 직접 로그인) |
| ⑤-4 주문서 (비회원) | `05e_checkout_guest.png` | 자동 |
| ⑥-1 결제수단 카드 | `06a_widget_card.png` | **수동** (결제수단 선택까지) |
| ⑥-2 카드사 드롭다운 | `06b_widget_card_select.png` | **수동** |
| ⑥-3 비씨카드 인증 | `06c_bc_auth.png` | **수동** (외부 popup) |

## 토스 PDF 가이드 의무 사항

- ✅ PPT 형식 (카드사 심사 양식 수정 대비)
- ✅ 북마크바 없이 도메인 노출 (`--start-maximized` + 신규 profile 로 북마크바 자동 숨김)
- ✅ PC 시간 함께 캡처 (`ImageGrab` 으로 Windows taskbar 시계 포함)
- ✅ 상품/서비스 명칭·이미지·금액 흐름 모두 확인
- ✅ 비씨카드 인증 화면까지 캡처

## 문제 해결

- **Chromium 창이 maximize 안 됨** — Windows display scaling 100% 권장
- **푸터 토글 클릭 실패** — 사이트 동적 hydration 지연. `--step 2` 로 단독 재시도
- **장바구니 담기 텍스트 못 찾음** — capture.py 의 selector 가 `"장바구니에 담기"` 정확 텍스트. 사이트에서 텍스트 바뀌면 수정

## 산출물

- `output/screenshots/*.png` — 단계별 캡처 (gitignore)
- `output/payment-route.pptx` — 최종 PPT (gitignore)
- `chrome-profile/` — 세션 유지용 persistent profile (gitignore)
