# Supabase Auth 이메일 템플릿 (GTR 브랜드)

> Supabase 인증 메일(가입 확인·이메일 변경 등)은 **Supabase가 발송**하며, 스타일은
> **Supabase 대시보드 템플릿**으로 제어한다 (Resend 브랜드 메일과 별개 파이프라인).
> 아래 HTML 을 대시보드에 붙여넣어 GTR 브랜드(= `newsletterWelcomeEmail` 셸)로 통일한다.
>
> - 적용 위치: Supabase 대시보드 → **Authentication → Emails** → 각 템플릿
> - 로고·링크는 `{{ .SiteURL }}` 을 사용 → Site URL(현 임시 `goodthings-roasters.com`,
>   통과 후 `goodthingsroasters.com`)을 자동 추종. **Site URL 만 맞으면 도메인 전환에도 안전.**
> - 디자인 토큰: #1C1B19(텍스트/버튼) · #4A4844(본문) · #EDEBE6(헤어라인) · 600px · padding 40px.
> - 셸은 `next/src/lib/email/templates/newsletterWelcomeEmail.ts` 와 1:1 정합.

---

## 1. Confirm signup (가입 인증)

기본 동작(`{{ .ConfirmationURL }}`)을 유지 — Supabase 호스티드 verify 링크라 커스텀 라우트 불필요.

**Subject:**
```
[굳띵즈] 가입 인증을 완료해 주세요
```

**Message body (HTML):**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:'Pretendard','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="left" style="padding:48px 40px 40px;">
              <img src="{{ .SiteURL }}/images/icons/logo-email.png" width="140" alt="good things"
                   style="display:block;width:140px;height:auto;border:0;outline:none;">
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 16px;">
              <h1 style="margin:0;font-size:26px;font-weight:600;color:#1C1B19;line-height:1.4;letter-spacing:-0.02em;">
                가입을 완료해 주세요
              </h1>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 32px;">
              <p style="margin:0;font-size:16px;color:#4A4844;line-height:1.75;">
                굳띵즈에 가입해 주셔서 감사합니다.<br>
                아래 버튼을 눌러 이메일 인증을 완료하시면 모든 서비스를 이용하실 수 있습니다.
              </p>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 64px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#1C1B19;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:16px 36px;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em;">
                      가입 인증 완료하기
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #EDEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:28px 40px 48px;">
              <p style="margin:0;font-size:13px;color:#4A4844;line-height:1.5;">
                본인이 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#4A4844;line-height:1.5;">
                문의 사항은
                <a href="mailto:hello@goodthingsroasters.com" style="color:#000000;text-decoration:none;font-weight:600;">hello@goodthingsroasters.com</a>
                으로 연락 주세요.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#4A4844;line-height:1.5;">
                © Good Things Roasters
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Change Email Address (이메일 등록/변경)

⚠️ **A1 필수** — 링크가 `{{ .ConfirmationURL }}` 이 아니라 **`{{ .SiteURL }}/auth/email-confirm?token_hash={{ .TokenHash }}&type=email_change`** 여야 우리 라우트(`app/auth/email-confirm/route.ts`)가 `verifyOtp` 로 처리한다. Secure email change = OFF 전제.

**Subject:**
```
[굳띵즈] 이메일 등록을 완료해 주세요
```

**Message body (HTML):**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:'Pretendard','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="left" style="padding:48px 40px 40px;">
              <img src="{{ .SiteURL }}/images/icons/logo-email.png" width="140" alt="good things"
                   style="display:block;width:140px;height:auto;border:0;outline:none;">
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 16px;">
              <h1 style="margin:0;font-size:26px;font-weight:600;color:#1C1B19;line-height:1.4;letter-spacing:-0.02em;">
                이메일 등록을 완료해 주세요
              </h1>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 32px;">
              <p style="margin:0;font-size:16px;color:#4A4844;line-height:1.75;">
                요청하신 이메일 등록을 확인하기 위한 메일입니다.<br>
                아래 버튼을 눌러 등록을 완료해 주세요. 완료 후 주문 조회·계정 복구 등에 사용됩니다.
              </p>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:0 40px 64px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#1C1B19;">
                    <a href="{{ .SiteURL }}/auth/email-confirm?token_hash={{ .TokenHash }}&type=email_change"
                       style="display:inline-block;padding:16px 36px;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em;">
                      이메일 등록 완료하기
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #EDEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:28px 40px 48px;">
              <p style="margin:0;font-size:13px;color:#4A4844;line-height:1.5;">
                본인이 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#4A4844;line-height:1.5;">
                문의 사항은
                <a href="mailto:hello@goodthingsroasters.com" style="color:#000000;text-decoration:none;font-weight:600;">hello@goodthingsroasters.com</a>
                으로 연락 주세요.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#4A4844;line-height:1.5;">
                © Good Things Roasters
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 적용 절차

1. Supabase 대시보드 → **Authentication → Emails**.
2. **Confirm signup** 템플릿: 위 §1 Subject + HTML 붙여넣기 → Save.
3. **Change Email Address** 템플릿: 위 §2 Subject + HTML 붙여넣기 → Save. (A1)
4. **URL Configuration → Site URL** = 현재 임시 도메인 `https://goodthings-roasters.com` 확인.
5. **Email → Secure email change = OFF** 확인 (Change Email 플로우 전제).

## 검증
- 가입(이메일/비번) 또는 마이페이지 이메일 등록 → 받은 메일이 GTR 브랜드(로고+버튼)로 표시.
- Change Email 링크 클릭 → `/auth/email-confirm` 거쳐 `/mypage?emailRegistered=1` 도착.
- 로고 미표시 시: Site URL 오설정 또는 배포본에 `/images/icons/logo-email.png` 부재 확인.

## 도메인 전환 시 (토스 통과 후)
- Site URL 을 `https://goodthingsroasters.com` 으로 변경하면 로고·링크가 자동 추종. 템플릿 HTML 재수정 불필요.

## 추가 템플릿 (선택 · 동일 셸 재사용 권장)
- **Reset password** / **Magic Link** 도 같은 셸로 통일 가능. 링크만 각 템플릿 기본 변수(`{{ .ConfirmationURL }}`) 사용, 제목·문구만 교체. 필요 시 추가 작성.
