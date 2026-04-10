/* ══════════════════════════════════════════
   SiteFooter
   프로토타입 <footer> / .footer / .f-* 그대로 이식
   BizToggle만 client component로 분리
   ══════════════════════════════════════════ */

import Link from 'next/link';
import BizToggle from './BizToggle';

export default function SiteFooter() {
  return (
    <footer className="blk">
      <div className="footer">
        <div className="f-inner">
          {/* 브랜드 + SNS */}
          <div className="f-brand">
            <div className="f-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/icons/logo.svg" alt="GOOD THINGS" />
            </div>
            <a
              className="footer-sns-link"
              href="https://www.instagram.com/goodthings_roasters/"
              target="_blank"
              rel="noreferrer"
            >
              <svg className="f-sns-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17,4c1.7,0,3,1.3,3,3v10c0,1.7-1.3,3-3,3H7c-1.7,0-3-1.3-3-3V7c0-1.7,1.3-3,3-3h10M17,2H7c-2.8,0-5,2.2-5,5v10c0,2.8,2.2,5,5,5h10c2.8,0,5-2.2,5-5V7c0-2.8-2.2-5-5-5h0Z" />
                <path d="M12,9c1.7,0,3,1.3,3,3s-1.3,3-3,3-3-1.3-3-3,1.3-3,3-3M12,7c-2.8,0-5,2.2-5,5s2.2,5,5,5,5-2.2,5-5-2.2-5-5-5h0Z" />
                <path d="M17,6c-.6,0-1,.4-1,1s.4,1,1,1,1-.4,1-1-.4-1-1-1h0Z" />
              </svg>
            </a>
          </div>

          {/* 태그라인 */}
          <div className="f-tagline">good things, simply roasted.</div>

          {/* 3열 네비 */}
          <div className="f-cols">
            <div>
              <div className="f-col-title">The Story</div>
              <Link href="/story" className="footer-col-link">The Story</Link>
              <Link href="/story#location" className="footer-col-link">Location</Link>
            </div>
            <div>
              <div className="f-col-title">Shop</div>
              <Link href="/shop" className="footer-col-link">Featured Beans</Link>
              <Link href="/menu" className="footer-col-link">Cafe Menu</Link>
            </div>
            <div>
              <div className="f-col-title">Contact</div>
              <Link href="/biz-inquiry" className="footer-col-link">Wholesale</Link>
            </div>
          </div>

          {/* 하단 법적 정보 */}
          <div className="f-bottom-wrap">
            <div className="f-bottom-row">
              <span className="f-copyright">© 2026 Good Things Roasters</span>
              <span className="f-bottom-sep">·</span>
              <BizToggle />
              <span className="f-bottom-sep">·</span>
              <span className="f-legal-link">이용약관</span>
              <span className="f-bottom-sep">·</span>
              <span className="f-legal-link">개인정보처리방침</span>
            </div>
            {/* 사업자 정보 인라인 (BizToggle이 open 클래스 토글) */}
            <div className="f-biz-inline" id="f-biz-detail">
              주식회사 브이티이코프<span className="f-biz-sep">·</span>
              대표 김주호<span className="f-biz-sep">·</span>
              사업자 등록번호 510-81-30238<span className="f-biz-sep">·</span>
              통신판매업 신고번호 2023-경북구미-0508<span className="f-biz-sep">·</span>
              주소 경북 구미시 인동21길 22-11<span className="f-biz-sep">·</span>
              전화번호 010-9062-9910<span className="f-biz-sep">·</span>
              이메일 jung6419@naver.com
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
