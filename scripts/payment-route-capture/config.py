"""
Toss 결제경로 PPT 캡처 / 조립 공용 설정.
"""
from pathlib import Path

BASE_URL = "https://goodthings-roasters.com"

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
# 사용자가 수동 캡처본을 images/screenshots/ 에 저장 — 그 경로 직접 사용.
SCREENSHOT_DIR = Path("C:/Git/goodthings-roasters/images/screenshots")
PROFILE_DIR = ROOT / "chrome-profile"
PPTX_PATH = OUTPUT_DIR / "payment-route.pptx"

# 캡처 파일명 — Toss PDF 6단계 + 회원/비회원 분기
CAPTURES = [
    # (key, description)
    ("02_footer",                "② 하단 정보 (사업자 6종)"),
    ("03_refund",                "③ 환불 규정 (/legal/returns)"),
    ("04a_login",                "④ 로그인 페이지"),
    ("04b_signup",               "④ 회원가입 페이지"),
    ("04c_guest_checkout",       "④ 비회원 구매 경로"),
    ("05a_shop",                 "⑤-1 상품 목록 (/shop)"),
    ("05b_pdp",                  "⑤-2 상품 상세"),
    ("05c_cart",                 "⑤-3 장바구니"),
    ("05d_checkout_member",      "⑤-4 주문서 (회원)"),
    ("05e_checkout_guest",       "⑤-4 주문서 (비회원)"),
    ("06a_widget_card",          "⑥-1 결제수단 카드 선택"),
    ("06b_widget_card_select",   "⑥-2 카드사 드롭다운"),
    ("06c_bc_auth",              "⑥-3 비씨카드 인증 화면 (수동 캡처)"),
]

# GTR 1440 baseline
VIEWPORT_WIDTH = 1440
VIEWPORT_HEIGHT = 900

# 사이트 응답 대기
PAGE_LOAD_TIMEOUT_MS = 30000
NETWORK_IDLE_TIMEOUT_MS = 5000
