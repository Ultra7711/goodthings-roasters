/* ══════════════════════════════════════════════════════════════════════════
   errorDescribe.ts — admin client 측 mutation error → 한글 toast 메시지 (S257)

   답습 source (3 곳 통합):
   - settings/_shared/helpers.ts (describeError · describeUploadError)
   - cafe-events/CafeEventsForm.tsx (인라인 동일 함수 중복)
   - gooddays/AdminGoodDaysClient.tsx (describeMutationError)

   products / menu 도메인의 인라인 ternary chain 폐기 대상 — 동일 코드 매핑을
   여기서 단일 SoT 로 관리. 새 도메인은 본 모듈 import 만 하면 됨.

   server-side error summarize 는 lib/admin/errors.ts (summarizePgError) 별도.
   ══════════════════════════════════════════════════════════════════════════ */

/** 공통 mutation error → 한글 toast 메시지.
 *
 *  지원 코드:
 *  - unauthorized: 권한 없음
 *  - validation_failed: 입력값 오류 (detail 옵션)
 *  - not_found: 대상 없음
 *  - slug_conflict / id_conflict: 중복
 *  - mismatch: 동시 편집 충돌 (reorder 등)
 *  - conflict: 일반 상태 충돌
 *  - no_changes: 변경사항 없음
 *  - invalid_image: 이미지 파일 손상/오류
 *  - server_error (fallback)
 */
export function describeError(error: string, detail?: string): string {
  switch (error) {
    case 'unauthorized':
      return '권한이 없습니다. 다시 로그인해 주세요.';
    case 'validation_failed':
      return `입력값을 확인해 주세요${detail ? ` (${detail})` : ''}`;
    case 'not_found':
      return '대상을 찾을 수 없습니다 (이미 삭제됐을 수 있어요).';
    case 'slug_conflict':
      return '동일한 slug 가 이미 존재합니다.';
    case 'id_conflict':
      return '동일한 ID 가 이미 존재합니다.';
    case 'mismatch':
      return '다른 화면에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.';
    case 'conflict':
      return '현재 상태에서는 해당 작업이 불가능합니다.';
    case 'no_changes':
      return '변경된 항목이 없습니다.';
    case 'invalid_image':
      return '이미지 파일이 올바르지 않습니다.';
    case 'server_error':
    default:
      return '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

/** 업로드 전용 error → 한글 toast 메시지.
 *
 *  지원 코드:
 *  - too_large: 파일 크기 초과 (detail 옵션 = 상한 안내)
 *  - unsupported_type: MIME 형식 미지원 (detail 옵션 = 허용 형식)
 *  - invalid_image: 이미지 파일 손상/오류
 *  - unauthorized: 권한 없음
 *  - public_url_failed: Storage URL 생성 실패
 *  - validation_failed: detail='file_too_large' 호환 (products image 답습)
 *  - upload_failed (fallback)
 */
export function describeUploadError(error: string, detail?: string): string {
  switch (error) {
    case 'too_large':
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하로 다시 시도해 주세요'}`;
    case 'unsupported_type':
      return `지원하지 않는 파일 형식이에요 — ${detail ?? 'webp/avif/jpeg/png · .html 만 지원합니다'}`;
    case 'invalid_image':
      return '이미지 파일을 읽을 수 없어요. 다른 파일로 시도해 주세요.';
    case 'unauthorized':
      return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
    case 'public_url_failed':
      return '업로드는 됐지만 주소를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'validation_failed':
      if (detail === 'file_too_large') return '파일이 너무 큽니다 (5MB 이하).';
      if (detail === 'file_missing') return '파일을 선택해 주세요.';
      return `입력값을 확인해 주세요${detail ? ` (${detail})` : ''}`;
    case 'upload_failed':
    default:
      return '파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

/** mutation action prefix 포함 toast 메시지 (gooddays 답습).
 *
 *  - 공통 error: `${action}하지 못했습니다. ${describeError(error, detail)}`
 *  - upload 계열 error 도 처리 (too_large · unsupported_type · invalid_image)
 *
 *  예: describeMutationError('정렬을 저장', 'unauthorized')
 *      → '정렬을 저장하지 못했습니다. 권한이 없습니다. 다시 로그인해 주세요.'
 */
export function describeMutationError(action: string, error: string, detail?: string): string {
  if (
    error === 'too_large' ||
    error === 'unsupported_type' ||
    error === 'invalid_image' ||
    error === 'public_url_failed' ||
    error === 'upload_failed'
  ) {
    return `${action}하지 못했습니다. ${describeUploadError(error, detail)}`;
  }
  return `${action}하지 못했습니다. ${describeError(error, detail)}`;
}
