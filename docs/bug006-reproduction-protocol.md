# BUG-006 재현 프로토콜 (D-008)

> **목적**: BUG-006 원본 증상("페이지 진입 시 푸터만 보이는 프레임" + S67 관찰 "시커먼 화면 번쩍임") 을 **frame 단위로 측정**해 원인을 단정하고, 수정 전후 비교 가능한 baseline 을 확보한다.
>
> **근거**: North Star 성공 조건 "재현 프로토콜에서 shell-only 프레임 0". 측정 없는 재설계는 North Star #1 에 의해 금지.
>
> **수립 세션**: S67 (2026-04-24) · 관련 Resolution: `memory/project_bug006_decisions_log.md` D-008

---

## 1. 증상 정의

| 항목 | 정의 |
|---|---|
| **S-black** | "시커먼 화면" — route 전환 직후 viewport 대부분이 다크 색으로 한 frame 이상 노출 |
| **S-footer-only** | `<main>` 콘텐츠가 비고 `<footer>` 가 viewport 에 들어오는 frame — layout 유지되나 main 빈 상태 |
| **S-combined** | S-black 과 S-footer-only 가 동시 발생 (S67 사용자 관찰: "시커먼 화면 + 푸터 번쩍") |

---

## 2. 원인 가설 (측정 대상)

| 코드 | 가설 | 판정 기준 |
|---|---|---|
| **H1** | `<html>` 다크 배경 (`#1E1B16`, globals.css L419) 이 route 전환 시 `.page-bg` 일시 투과로 노출 | S-black frame 색 = `#1E1B16` (±3%) |
| **H2** | Next.js 16 prefetch 결과가 client-only boundary 포함 → initial paint 가 빈 박스 | S-footer-only frame 의 `<main>` innerHTML = empty / skeleton |
| **H3** | `(main)/loading.tsx` 가 예기치 않은 시점에 렌더되거나 누락 | Performance timeline 의 "Navigation Start" 이후 loading shell paint 유무 |
| **H4** | 히어로 섹션의 자체 dark 배경 (예: `--color-background-inverse`) 이 viewport 에 즉시 덮이지만 내부 콘텐츠(글자·영상) 가 늦음 → 다크 plane 만 보임 | S-black 영역의 bounding rect 가 hero section 크기와 일치 |
| **H5** | React reconciliation 의 빈 trees frame (prev page unmount → next page mount 사이 한 frame) | S-combined 발생 시점이 React commit phase 와 정확히 일치 |

---

## 3. 측정 환경

### 하드웨어
- 모바일 실기기 (iPhone / Android) — 사용자 주 관찰 환경
- 또는 데스크탑 Chrome + Mobile Emulation (보조 측정)

### 소프트웨어
- Chrome DevTools Performance 탭
- Settings:
  - **Screenshots**: ON (필수)
  - **Network**: `Slow 4G` 또는 `Fast 3G`
  - **CPU**: `4x slowdown`
  - **Web Vitals**: ON (선택)
  - **Memory**: OFF (분석 집중)

### 대상 URL
- Vercel Production: `goodthings-roasters.vercel.app`
- 또는 Preview URL (해당 브랜치 배포 후)

### 캐시
- 매 측정 전 **Hard Reload (Ctrl+Shift+R)** → 첫 방문 상태 재현
- cart/auth 상태는 각 시나리오마다 동일 조건 유지

---

## 4. 재현 경로 (P1 ~ P5)

| 코드 | 재현 시퀀스 | S67 현황 |
|---|---|---|
| **P1** | 메뉴 페이지 진입 → 하단 스크롤 → 햄버거 → **Shop** 클릭 | **100% 재현** (DB-04) |
| **P2** | 홈 → 햄버거 → **로그인** 클릭 | 재현 (빠름) |
| **P3** | 홈 → 햄버거 → **마이페이지** 클릭 (로그인 상태) | 재현 (빠름) |
| **P4** | 홈 → 햄버거 → **Wholesale** 클릭 | 재현 (빠름) |
| **P5** | 홈 → 햄버거 → **The Story** 클릭 | 재현 여부 측정 대상 |
| **P6** | `/cart` 직접 URL 진입 (Stage E 전후 비교용) | Stage E 이후 관찰 대상 |

---

## 5. 측정 단계

각 경로마다 다음 절차 반복:

1. **캐시 정리** — Hard Reload
2. **DevTools Performance 탭 열기** — Recording 버튼 대기
3. **준비 상태 확보** — 재현 경로의 출발 페이지로 이동 + 필요 조건 세팅 (스크롤 위치 등)
4. **Recording 시작** — `● Record` 클릭 (또는 Ctrl+E)
5. **재현 동작 실행** — 햄버거 오픈 → 타겟 Link 탭
6. **새 페이지 paint 완료 대기** — 2~3초 추가 유지 (after frame 확보)
7. **Recording 중지**
8. **Export** — `.json` 으로 저장 (재분석 가능)

---

## 6. 분석 항목

### 6-1. 타임라인 키 이벤트 추출

| 이벤트 | 식별 방법 | 기록 |
|---|---|---|
| **t0** (click) | "Click" 또는 "PointerUp" 이벤트 | ms 단위 |
| **t_unmount** | 이전 page 의 DOM 사라진 시점 (Layout 이벤트) | ms |
| **t_black_start** | Screenshots 에서 S-black 첫 frame | ms |
| **t_black_end** | S-black 마지막 frame | ms |
| **t_footer_start** | S-footer-only 첫 frame | ms |
| **t_footer_end** | S-footer-only 마지막 frame | ms |
| **t1** (paint) | 새 page 콘텐츠 첫 paint (FCP/LCP) | ms |

### 6-2. 프레임 색 확인

- Screenshots 패널에서 S-black 의심 frame 클릭
- Elements 탭 > Computed > `background-color` 로 해당 픽셀 원인 요소 추적
- 색값 추출: Chrome DevTools "Inspect" 모드 + color picker
- **`#1E1B16` ±3% 일치 시 H1 증명**

### 6-3. 레이어 분석

- Performance 탭 > Layers (또는 `Ctrl+Shift+P` → "Show Layers")
- t_black_start 시점의 compositor layer 스냅샷
- 어떤 요소가 viewport 를 덮고 있는지 확인
  - html / body / .page-bg / .root / main / 기타

### 6-4. Main 콘텐츠 상태 (H2 검증)

- t_footer_start 시점의 DOM 스냅샷 (Performance 대신 별도 재현 + Console `document.querySelector('main').innerHTML.length` 출력)
- 값이 작으면 (< 200 chars) H2 증명

---

## 7. 기록 양식

각 경로별로 1행씩 작성 후 `memory/project_bug006_measurement_log.md` 신규 파일에 누적.

```markdown
## P1 · 메뉴 → 햄버거 → Shop (2026-MM-DD · <기기>)

| 지표 | 값 |
|---|---|
| t0 → t1 총 gap | _ ms |
| S-black 색 | _ (#hex) |
| S-black duration | _ ms |
| S-footer-only duration | _ ms |
| 덮은 레이어 | _ (html / .page-bg 등) |
| main innerHTML 길이 | _ chars |
| 판정 | H1 / H2 / H3 / H4 / H5 / 복합 |
| 스크린샷 | _ (파일 경로) |
| 원본 profile | _ (.json 경로) |
```

---

## 8. 원인 단정 기준

| 조건 | 단정 |
|---|---|
| S-black 색 = `#1E1B16` + 덮은 레이어 = html | **H1 확정** |
| main innerHTML empty + footer visible | **H2 확정** |
| t_black_start 직전에 loading shell 렌더 없음 | **H3 확정** |
| S-black 영역 = hero section bbox | **H4 확정** |
| S-combined 시점 = React commit phase boundary | **H5 확정** |

**두 개 이상 조건 충족 시 복합 원인.**

---

## 9. 수정 후 성공 기준 (BUG-006 closure 조건)

각 경로 P1~P5 에서:

- **S-black frame count 0** OR S-black duration < 16ms (1 frame)
- **S-footer-only frame count 0** OR duration < 16ms
- 총 gap (t0 → t1) 은 감소 방향이면 OK (0 달성은 요구하지 않음 — 네트워크 의존)

전 경로 충족 시 North Star 성공 조건 달성 → `decisions_log` 에 closure Resolution 기록.

---

## 10. 실행 전 체크리스트

- [ ] Vercel Preview 또는 Production URL 확정
- [ ] Chrome DevTools Performance 탭 사용법 숙지
- [ ] Screenshots 옵션 ON 확인
- [ ] Mobile emulation 또는 실기기 결정
- [ ] Network/CPU throttling 세팅
- [ ] 측정 결과 저장 폴더 결정 (e.g. `docs/perf-captures/2026-MM-DD/`)
- [ ] 경로별 baseline profile `.json` + screenshot 저장 경로 결정

---

## 11. 보조 진단 (측정 전 빠른 검증)

### 11-1. html 다크 배경 가설 검증 (H1) — 5분 실험

1. DevTools Console:
   ```js
   document.documentElement.style.background = '#ff00ff'; // 형광핑크
   ```
2. 햄버거 → Shop 클릭
3. 시커먼 자리에 **형광핑크** 가 보이면 **H1 확정** (html 배경이 노출되는 경로)
4. 여전히 시커먼 이면 **H1 기각** → 다른 레이어 원인

### 11-2. .page-bg 유지 확인

1. DevTools Console:
   ```js
   // route 전환 직후까지 .page-bg 존재 여부 폴링
   const t0 = performance.now();
   const id = setInterval(() => {
     const el = document.querySelector('.page-bg');
     console.log(performance.now() - t0, el ? 'exists' : 'MISSING');
   }, 16);
   setTimeout(() => clearInterval(id), 2000);
   ```
2. 햄버거 → Shop 클릭
3. 출력 중 `MISSING` 한 번이라도 나오면 `.page-bg` 가 unmount 되는 것 → H1 강력 증거

### 11-3. 히어로 배경 노출 가설 (H4) — 5분 실험

1. DevTools Console:
   ```js
   const style = document.createElement('style');
   style.textContent = '.hero, [class*="hero"] { background: #ff00ff !important; }';
   document.head.appendChild(style);
   ```
2. 햄버거 → Shop 클릭
3. 시커먼 자리에 형광핑크 = H4 확정

---

## 12. 다음 세션 첫 단계

1. 본 프로토콜의 §11 보조 진단 먼저 실행 (5~10분)
2. 결과에 따라:
   - H1 확정 → `.page-bg` unmount 원인 조사 또는 `<html>` 배경을 light 로 전환
   - H2 확정 → Suspense / skeleton SSR 추가
   - H4 확정 → 히어로 배경 전환 타이밍 조정
3. §4~§7 전체 프로토콜은 보조 진단으로도 원인 확정 못 할 때만 실행 (30~60분)
4. 수정 시도 → §9 성공 기준으로 after 측정

---

## 결과 문서 포인터

- **결정**: `memory/project_bug006_decisions_log.md` D-008
- **North Star**: `memory/project_bug006_north_star.md`
- **이월 증상 카탈로그**: `memory/project_bug006_deferred_bugs.md`
- **측정 기록 (신규)**: `memory/project_bug006_measurement_log.md` (첫 실행 시 생성)
- **금지 패턴**: `memory/project_flash_debugging_failure_catalog.md`
