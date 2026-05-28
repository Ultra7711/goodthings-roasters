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
    """③ 환불 규정 (/legal/returns)."""
    print("\n[Step 3] 환불 규정 캡처")
    page.goto(f"{BASE_URL}/legal/returns", timeout=PAGE_LOAD_TIMEOUT_MS)
    wait_settle(page, 800)
    grab_full_screen("03_refund")


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
