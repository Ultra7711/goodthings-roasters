/* ══════════════════════════════════════════
   Story Route — /story
   RP-6a 재이식: 프로토타입 #story-page 이식.
   - StoryPage 는 클라이언트 컴포넌트 (useEffect 진입 연출)
   - 해시 `/story#location` → <section id="location"> 로 자동 스크롤
   ══════════════════════════════════════════ */

import StoryPage from '@/components/story/StoryPage';

export const metadata = {
  title: '스토리',
  description: 'good things, simply roasted. 굳띵즈 로스터스가 커피를 굽는 방식과 공간을 소개합니다.',
  alternates: { canonical: '/story' },
};

export default function StoryRoute() {
  return <StoryPage />;
}
