/* ══════════════════════════════════════════
   NicknameEditForm — 리뷰 작성자 닉네임 편집 (유저 리뷰 Phase 1 Step 0)

   목적: 가입 시 자동생성된 닉네임(커피/카페 테마)을 사용자가 자유 편집.
   AccountInfoRow 에 "닉네임" row + 편집 폼 reveal. EmailRegisterForm 패턴 답습.
   검증 = Zod(updateNickname server action) + 클라 즉시 검증(2~20·HTML 차단).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { updateNickname } from '@/lib/profile';
import { shakeFields } from '@/lib/shakeFields';
import { useInputNav } from '@/hooks/useInputNav';
import { TextField } from '@/components/ui/TextField';
import ToggleIcon from './ToggleIcon';
import { useMyPageNicknameOpen, setNicknameOpen } from '@/lib/myPageUiStore';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const NICKNAME_INVALID_RE = /[<>&"']/;

type Props = {
  initialNickname: string;
};

export default function NicknameEditForm({ initialNickname }: Props) {
  const { show: toast } = useToast();
  const isOpen = useMyPageNicknameOpen();
  const formRef = useRef<HTMLDivElement>(null);

  /* 표시용 현재 닉네임 — 저장 성공 시 갱신 (즉시 반영) */
  const [nickname, setNickname] = useState(initialNickname);
  /* 편집 input draft */
  const [draft, setDraft] = useState(initialNickname);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setLoading] = useState(false);

  const open = useCallback(() => {
    setDraft(nickname);
    setError(undefined);
    setNicknameOpen(true);
  }, [nickname]);

  const close = useCallback(() => {
    setNicknameOpen(false);
  }, []);

  const onChange = useCallback((value: string) => {
    setDraft(value);
    setError(undefined);
  }, []);

  const validate = useCallback((value: string): string | undefined => {
    if (value.length < NICKNAME_MIN) return `닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`;
    if (value.length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`;
    if (NICKNAME_INVALID_RE.test(value)) return '사용할 수 없는 문자가 포함되어 있습니다.';
    return undefined;
  }, []);

  const submit = useCallback(async () => {
    const trimmed = draft.trim();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (trimmed === nickname) {
      setNicknameOpen(false);
      return;
    }

    setLoading(true);
    const res = await updateNickname(trimmed);
    setLoading(false);

    if (res.ok) {
      setNickname(res.nickname);
      setNicknameOpen(false);
      toast('닉네임이 변경되었습니다.');
      return;
    }
    if (res.error === 'invalid') {
      setError(res.message ?? '올바르지 않은 닉네임입니다.');
      return;
    }
    if (res.error === 'unauthenticated') {
      toast('로그인이 필요합니다.');
      return;
    }
    toast('닉네임 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }, [draft, nickname, validate, toast]);

  const nav = useInputNav(formRef);

  return (
    <>
      <div
        className="mp-info-row mp-info-row--action"
        role="button"
        tabIndex={0}
        aria-label={isOpen ? '닫기' : '닉네임 편집'}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            isOpen ? close() : open();
          }
        }}
      >
        <span className="mp-info-label">닉네임</span>
        <span className="mp-info-addr-right">
          <span className="mp-info-value">{nickname}</span>
          <span className="mp-icon-btn" aria-hidden="true">
            <ToggleIcon open={isOpen} />
          </span>
        </span>
      </div>
      <div className={`mp-form-reveal${isOpen ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner" ref={formRef}>
          <TextField
            label="닉네임"
            autoComplete="off"
            maxLength={NICKNAME_MAX}
            value={draft}
            onChange={onChange}
            onKeyDown={nav}
            error={error}
            helper="리뷰에 표시되는 이름입니다. 2~20자."
          />
          <div className="mp-form-reveal-actions">
            <button className="mp-cancel-btn" type="button" onClick={close} data-gtr-tap>
              취소
            </button>
            <button
              className="mp-save-btn"
              type="button"
              disabled={isLoading}
              onClick={() => {
                void submit();
                setTimeout(() => shakeFields(formRef.current), 0);
              }}
              data-gtr-tap
            >
              {isLoading ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
