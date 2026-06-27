"""
Toss 결제경로 PPT 캡처 자동화.

흐름: Playwright (Chromium headed · persistent profile) + PIL.ImageGrab.
- Chromium 창을 maximized 로 띄워 주소창과 OS taskbar 시계가 보이게 함.
- 각 단계는 Toss PDF 6단계 순서. interactive prompt 로 회원 로그인 등
  사람이 개입해야 하는 단계는 사용자 Enter 대기.

실행:
    pip install -r requirements.txt
    playwright install chromium
    python capture.py            # 전체 캡처
    python capture.py --step 5   # 특정 step 부터 재개
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, Playwright, sync_playwright
from PIL import ImageGrab

from config import (
    BASE_URL,
    PAGE_LOAD_TIMEOUT_MS,
    PROFILE_DIR,
    SCREENSHOT_DIR,
    VIEWPORT_HEIGHT,
    VIEWPORT_WIDTH,
)


def grab_full_screen(filename: str) -> None:
    """전체 데스크탑 캡처 (주소창 + Windows taskbar 시계 포함)."""
    out = SCREENSHOT_DIR / f"{filename}.png"
    img = ImageGrab.grab(all_screens=False)
    img.save(out)
    print(f"  saved: {out.name} ({img.size[0]}x{img.size[1]})")


def wait_settle(page: Page, extra_ms: int = 600) -> None:
    """networkidle + 추가 settle. 애니메이션·hydration 안정화."""
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(extra_ms)


def pause(label: str) -> None:
    """사용자가 수동 조작 후 Enter 입력하면 다음 단계."""
    print(f"\n[수동] {label}")
    print("       완료 후 이 터미널에 Enter 입력 →")
    input()


# ── 단계별 캡처 ─────────────────────────────────────


def step_02_footer(page: Page) -> None:
    """② 하단 정보 (푸터 사업자 6종)."""
    print("\n[Step 2] 하단 정보 캡처")
    page.goto(f"{BASE_URL}/", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1500)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(800)
    toggle = page.locator("button.f-biz-toggle")
    if toggle.count() > 0:
        toggle.first.click()
        page.wait_for_timeout(1200)
    grab_full_screen("02_footer")


def step_03_refund(page: Page) -> None:
    """③ 환불 규정 (/legal/returns) — 페이지가 길어 2장 분할(compose SLIDE_PLAN: 03_refund · 03_refund_2).

    오늘(S340) [자동결제 실패 시] 블록 추가로 더 길어짐 → 상단/하단 스크롤 분할 캡처.
    """
    print("\n[Step 3] 환불 규정 캡처 (2장 분할)")
    page.goto(f"{BASE_URL}/legal/returns", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    pause("③-1 상단(주문취소·정기배송 해지·[자동결제 실패 시])이 보이게 스크롤 맞추고 Enter (03_refund)")
    grab_full_screen("03_refund")
    pause("③-2 하단(반품·교환·배송비 부담·환불 절차)으로 스크롤하고 Enter (03_refund_2)")
    grab_full_screen("03_refund_2")


def step_04_auth(page: Page) -> None:
    """④ 로그인 + 회원가입 + 비회원 구매 경로."""
    print("\n[Step 4] 로그인 / 회원가입 / 비회원 구매 경로")

    # 4a — 로그인 화면
    page.goto(f"{BASE_URL}/login?from=checkout", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    grab_full_screen("04a_login")

    # 4b — 회원가입 (LoginPage 안의 switch 버튼 클릭)
    try:
        page.get_by_role("button", name="회원가입").first.click(timeout=3000)
        page.wait_for_timeout(800)
        grab_full_screen("04b_signup")
    except Exception as e:
        print(f"  [warn] 회원가입 전환 실패: {e}")

    # 4c — 비회원 구매 경로 (checkout 비회원 분기)
    page.goto(f"{BASE_URL}/checkout", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1200)
    grab_full_screen("04c_guest_checkout")


def step_05_shop_to_cart(page: Page) -> None:
    """⑤-1~3 상품 목록 → 상세 → 장바구니."""
    print("\n[Step 5-1] 상품 목록")
    page.goto(f"{BASE_URL}/shop", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1200)
    grab_full_screen("05a_shop")

    print("[Step 5-2] 상품 상세 (첫 활성 상품 자동 선택)")
    # 첫 카드 클릭 (품절 제외)
    first_card = page.locator("[data-slug]").first
    slug = first_card.get_attribute("data-slug")
    print(f"  selected slug: {slug}")
    first_card.click()
    wait_settle(page, 1500)
    grab_full_screen("05b_pdp")

    print("[Step 5-3] 장바구니 (자동으로 담은 후 /cart)")
    try:
        page.get_by_text("장바구니에 담기", exact=True).first.click(timeout=5000)
        page.wait_for_timeout(1200)
        # CartDrawer 가 열림 — 닫고 /cart 로 직접 이동
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    except Exception as e:
        print(f"  [warn] 장바구니 담기 실패 (수동 진행 필요): {e}")
    page.goto(f"{BASE_URL}/cart", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1000)
    grab_full_screen("05c_cart")


def step_05_checkout_guest(page: Page) -> None:
    """⑤-4 (비회원) 주문서."""
    print("\n[Step 5-4 비회원] /checkout 진입 (게스트)")
    page.goto(f"{BASE_URL}/checkout", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1500)
    grab_full_screen("05e_checkout_guest")


def step_05_checkout_member(page: Page) -> None:
    """⑤-4 (회원) 주문서 — 사용자가 직접 로그인 후 진입."""
    print("\n[Step 5-4 회원] 사용자 직접 로그인")
    page.goto(f"{BASE_URL}/login?from=checkout", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    pause("회원 계정으로 로그인하시고 / 주문서까지 진입하시면 캡처합니다.")
    grab_full_screen("05d_checkout_member")


def step_06_payment_widget() -> None:
    """⑥ 카드 결제경로 — 결제수단 카드 선택 + 카드사 드롭다운."""
    print("\n[Step 6] 결제위젯 카드 + 카드사 드롭다운")
    pause("주문 정보 입력 → 결제수단 '카드' 선택 상태로 두고 Enter (06a 캡처)")
    grab_full_screen("06a_widget_card")
    pause("카드사 드롭다운 열어두고 Enter (06b 캡처)")
    grab_full_screen("06b_widget_card_select")
    pause("결제하기 → 비씨카드 인증 화면 뜨면 Enter (06c 캡처)")
    grab_full_screen("06c_bc_auth")


def step_07_billing_legal(page: Page) -> None:
    """⑦ 빌링 PPT 약관 슬라이드 재캡처 (S340 약관 R-4 정합).

    정기배송 약관 변경(자동결제 동의·가격고정·결제실패 자동정지·재등록)을 반영해
    b_compose.py SLIDE_PLAN 의 약관 3종을 다시 캡처한다. 페이지가 길어 스크롤 위치
    조정이 필요하므로 각 단계 pause 로 사용자가 화면을 맞춘 뒤 캡처한다.
    (일반 PPT 의 03_refund 는 step_03_refund 와 동일 페이지 — `--step 3` 으로 별도 갱신.)
    """
    print("\n[Step 7] 빌링 약관 재캡처 (returns / payment-faq / terms §10조의2)")

    # 7-1 환불 정책 (정기배송) — /legal/returns ([자동결제 실패 시] 블록 추가됨)
    page.goto(f"{BASE_URL}/legal/returns", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    pause("'정기배송 해지·환불' + '[자동결제 실패 시]' 블록이 보이게 스크롤 맞추고 Enter (b_03_refund_returns)")
    grab_full_screen("b_03_refund_returns")

    # 7-2 정기결제 Q&A — /legal/payment-faq ('자동결제 실패 시' Q 추가됨)
    page.goto(f"{BASE_URL}/legal/payment-faq", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    pause("'정기배송 자동결제가 실패하면' Q 가 보이게 스크롤 맞추고 Enter (b_03_refund_faq)")
    grab_full_screen("b_03_refund_faq")

    # 7-3 이용약관 §10조의2 (정기배송) — /legal/terms (6항 → 10항 개정)
    page.goto(f"{BASE_URL}/legal/terms", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    try:
        page.get_by_text("제10조의2", exact=False).first.scroll_into_view_if_needed(timeout=4000)
        page.wait_for_timeout(500)
    except Exception as e:
        print(f"  [warn] §10조의2 자동 스크롤 실패(수동 조정 필요): {e}")
    pause(
        "§10조의2(정기배송) 조항이 보이게 스크롤 맞추고 Enter (b_app_b_terms_no_lockin)\n"
        "       ※ 10개 항으로 길어져 한 화면에 안 들어오면 핵심 항(자동결제 동의·가격고정·"
        "결제실패·즉시 해지) 위주로. 2장 필요 시 b_compose.py SLIDE_PLAN 분할 검토."
    )
    grab_full_screen("b_app_b_terms_no_lockin")


def step_08_billing_pdp_cart(page: Page) -> None:
    """⑧ 빌링 PPT 상품 경로 — 정기배송 PDP(일반/토글 ON) + 장바구니 (자동 + 수동 fallback).

    SLIDE_PLAN: b_app_a1_pdp_normal · b_05b_pdp_subscription ·
    b_app_a2_pdp_subscription · b_05c_cart_subscription.
    정기배송 가능 상품(PDP 에 '정기배송으로 받기' 토글 존재)을 자동 탐색한다.
    """
    print("\n[Step 8] 빌링 상품 경로 (정기배송 PDP + 장바구니)")
    page.goto(f"{BASE_URL}/shop", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1200)

    # 정기배송 가능 상품 자동 탐색 (앞쪽 카드 최대 8개)
    sub_slug = None
    cards = page.locator("[data-slug]")
    for i in range(min(cards.count(), 8)):
        slug = cards.nth(i).get_attribute("data-slug")
        page.goto(f"{BASE_URL}/shop/{slug}", timeout=PAGE_LOAD_TIMEOUT_MS)
        wait_settle(page, 1000)
        if page.get_by_text("정기배송으로 받기").count() > 0:
            sub_slug = slug
            print(f"  정기배송 가능 상품: {slug}")
            break
    if sub_slug is None:
        pause("정기배송 가능 상품 자동 탐색 실패 — 정기배송 상품 PDP 로 직접 이동 후 Enter")

    # 어필-1: 일반 결제 상태(토글 OFF) PDP
    grab_full_screen("b_app_a1_pdp_normal")

    # 정기배송 토글 ON → 주기 select reveal
    try:
        page.get_by_text("정기배송으로 받기").first.click(timeout=4000)
        page.wait_for_timeout(600)
    except Exception as e:
        print(f"  [warn] 정기배송 토글 클릭 실패(수동): {e}")
        pause("'정기배송으로 받기' 체크 후 Enter")
    grab_full_screen("b_05b_pdp_subscription")
    grab_full_screen("b_app_a2_pdp_subscription")  # 분기 비교용(동일 화면 · 별도 슬라이드)

    # 장바구니 담기 → /cart (정기배송 라벨 노출)
    try:
        page.get_by_text("장바구니에 담기", exact=True).first.click(timeout=5000)
        page.wait_for_timeout(1200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    except Exception as e:
        print(f"  [warn] 장바구니 담기 실패(수동): {e}")
        pause("정기배송 상품을 장바구니에 담은 후 Enter")
    page.goto(f"{BASE_URL}/cart", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 1000)
    grab_full_screen("b_05c_cart_subscription")


def step_09_billing_checkout_widget(page: Page) -> None:
    """⑨ 빌링 PPT 주문서 + 빌링 결제창 (수동 — 회원 로그인 + γ 합산 + 토스 빌링창).

    SLIDE_PLAN: b_05d_checkout_subscription · b_06a_billing_card · b_06b_billing_transfer.
    b_06a/b 는 토스 빌링 입력창(외부 화면 · 우리 헤더 없음)이라 헤더 변경과 무관 —
    UI 변동 없으면 기존 캡처 재사용 가능. PC 시계만 최신이면 됨.
    """
    print("\n[Step 9] 빌링 주문서 + 빌링 결제창 (수동)")
    page.goto(f"{BASE_URL}/login?from=checkout", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    pause("회원 로그인 → 정기배송 상품 주문서(γ 합산 · 정기결제 분기)까지 진입 후 Enter (b_05d_checkout_subscription)")
    grab_full_screen("b_05d_checkout_subscription")
    pause("결제수단 '카드' 빌링 입력창이 뜨면 Enter (b_06a_billing_card · 변경 없으면 기존 재사용 가능)")
    grab_full_screen("b_06a_billing_card")
    pause("결제수단 '계좌이체' 빌링 입력창으로 전환 후 Enter (b_06b_billing_transfer)")
    grab_full_screen("b_06b_billing_transfer")


# ── 메인 ─────────────────────────────────────


def run(start_step: int) -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:  # noqa: PLR1702 — straightforward sequence
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            channel="chrome",
            args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
                "--hide-crash-restore-bubble",
            ],
            viewport=None,
            no_viewport=True,
            accept_downloads=False,
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.set_viewport_size({"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT})

        # 새 profile → 북마크바 자동 숨김. 시작 시 잠시 대기로 모달 닫기 등 안정화
        page.wait_for_timeout(1500)

        steps = [
            (2, step_02_footer),
            (3, step_03_refund),
            (4, step_04_auth),
            (5, lambda pg: (step_05_shop_to_cart(pg), step_05_checkout_guest(pg), step_05_checkout_member(pg))),
            (6, lambda _: step_06_payment_widget()),
            # 빌링(정기결제) PPT 전용 단계 — b_compose.py SLIDE_PLAN 대응
            (7, step_07_billing_legal),
            (8, step_08_billing_pdp_cart),
            (9, step_09_billing_checkout_widget),
        ]
        for idx, fn in steps:
            if idx < start_step:
                continue
            try:
                fn(page)
            except Exception as e:
                print(f"\n[ERROR] step {idx}: {e}", file=sys.stderr)
                pause("진행 후 Enter 입력하면 다음 단계로 이동합니다.")

        print("\n캡처 완료. compose.py 로 PPT 조립 가능.")
        pause("브라우저 종료 전 Enter")
        context.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", type=int, default=2, help="시작 step 번호 (기본 2)")
    args = parser.parse_args()
    run(args.step)


if __name__ == "__main__":
    main()
