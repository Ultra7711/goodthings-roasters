-- ═══════════════════════════════════════════════════════════════════════════
-- 095_site_settings_points.sql — 포인트 정책 설정 (Phase 1)
--
-- 목적 (docs/points-implementation-plan.md §2 DEC-P2~P8 · §8 DEC-P8):
--   적립률·적립시점·만료·트리거·사용 규칙을 어드민 동적 설정으로 둔다(032 패턴).
--   코드 하드코딩 0 — 재배포 없이 운영 중 조정. UI 표시(U1~U9)도 이 설정에 연동.
--
-- 마스터 토글(DEC-P8):
--   enabled=false 로 시드 → 라이브 전 구축 후 정책 확정 전까지 시스템 흔적 0.
--   정책 확정 시 어드민에서 ON + 적립률 설정 → 전 UI 자동 노출.
--
-- 스키마 권위:
--   본 row 의 value JSONB 형상은 lib/siteSettings.ts 의 PointsSettingsSchema(Zod)가
--   책임진다(032 주석 정책 동일). 본 seed 는 안전한 초기값.
--
-- 참조:
--   - 032_site_settings.sql (site_settings 테이블·RLS·seed 패턴)
--   - docs/points-implementation-plan.md §2(정책 DEC)·§8(UI 연동)
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.site_settings (key, value)
values (
  'points',
  jsonb_build_object(
    -- 마스터 토글(DEC-P8). false = U1~U9 전부 숨김·시스템 미가동.
    'enabled', false,

    -- 적립(earn) — DEC-P2 적립률·DEC-P1 적립시점·DEC-P4 트리거
    'earn', jsonb_build_object(
      'enabled', true,
      'rate', 0.01,           -- 결제액 대비 적립률(소수). 1% 기본값(운영 시작 시 확정).
      'timing', 'delivered',  -- DEC-P1: 구매 확정(배송완료) 후 적립
      'triggers', jsonb_build_object(
        'signup',   jsonb_build_object('enabled', false, 'amount', 0),
        'review',   jsonb_build_object('enabled', false, 'amount', 0),
        'birthday', jsonb_build_object('enabled', false, 'amount', 0)
      )
    ),

    -- 사용(redeem) — DEC-P7 회원만·최소사용액·결제액 대비 최대비율
    'redeem', jsonb_build_object(
      'enabled', true,
      'min', 1000,            -- 최소 사용 포인트
      'max_ratio', 1.0        -- 결제액 대비 최대 사용 비율(1.0 = 전액 사용 허용)
    ),

    -- 만료(expiry) — DEC-P3 구조 지원·초기 무만료
    'expiry', jsonb_build_object(
      'enabled', false,
      'months', 12            -- 만료 ON 시 적립 후 개월 수(전상법 소멸 고지)
    )
  )
)
on conflict (key) do nothing;

comment on column public.site_settings.value is
  '영역별 JSONB payload. 스키마는 코드(lib/siteSettings.ts) Zod 가 책임. (notice·shipping·home_featured·hours·points)';
