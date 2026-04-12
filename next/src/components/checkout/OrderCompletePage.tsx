/* ══════════════════════════════════════════
   OrderCompletePage — /order-complete
   프로토타입 #order-complete-page 이식 (RP-7).

   설계 결정:
   1. sessionStorage 'gtr-last-order' 에서 주문 정보 읽기
      (CheckoutPage 제출 시 저장)
   2. 진입 연출: .ocp-enter 래퍼 → staggerUp CSS 애니메이션
   3. 주문번호 복사: navigator.clipboard
   4. 주문 내역 보기: /mypage (데모, Phase 2-F 연동)
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/lib/utils';

type OrderItemData = {
  name: string;
  slug: string;
  category: string;
  volume: string | null;
  qty: number;
  priceNum: number;
  image: { src: string; bg: string };
  type?: string;
  period?: string | null;
};

type LastOrder = {
  number: string;
  items: OrderItemData[];
};

/* ── 한글명 추출 ── */
function extractKrName(name: string): string {
  const m = name.match(/^(.*[\uAC00-\uD7AF](?:\s+[A-Z0-9]+)*)\s+([A-Z][a-z].*)$/);
  return m ? m[1].trim() : name;
}

/* ── 복사 아이콘 ── */
function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" />
    </svg>
  );
}

export default function OrderCompletePage() {
  const router = useRouter();
  const { show: toast } = useToast();
  const [entered, setEntered] = useState(false);

  /* sessionStorage 에서 주문 정보 읽기 */
  const order = useMemo<LastOrder | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('gtr-last-order');
      if (!raw) return null;
      return JSON.parse(raw) as LastOrder;
    } catch {
      return null;
    }
  }, []);

  /* 진입 연출 트리거 */
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* 주문번호 복사 */
  const handleCopy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.number);
      toast('주문번호가 복사되었습니다.');
    } catch {
      toast('복사에 실패했습니다.');
    }
  };

  /* 주문 정보 없음 보호 */
  if (!order) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="ocp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="chp-hdr-inner">
            <Link href="/">
              <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} style={{ cursor: 'pointer' }} />
            </Link>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: '80px 60px' }}>
          <p style={{ fontFamily: 'var(--font-kr)', fontSize: 'var(--type-body-l-size)', color: 'var(--color-text-secondary)' }}>
            주문 정보를 찾을 수 없습니다.
          </p>
          <Link href="/" className="ocp-btn-primary" style={{ maxWidth: 280, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* ── 미니 헤더 ── */}
      <div className="ocp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} style={{ cursor: 'pointer' }} />
          </Link>
        </div>
      </div>

      {/* ── 바디 ── */}
      <div className="ocp-body">
        <div className={`ocp-inner${entered ? ' ocp-enter' : ''}`}>
          <h1 className="ocp-title">주문이 정상적으로<br />완료 되었습니다.</h1>

          <div className="ocp-order-num">
            <span>주문번호</span>
            <strong onClick={handleCopy}>{order.number}</strong>
            <button className="ocp-copy-btn" title="주문번호 복사" aria-label="주문번호 복사" onClick={handleCopy}>
              <CopyIcon />
            </button>
          </div>

          <p className="ocp-subtitle">주문번호는 배송조회하실 때 필요합니다.</p>

          <div className="ocp-summary">
            {order.items.map((item, idx) => (
              <div key={idx} className="ocp-item">
                <div className="ocp-item-img" style={{ background: item.image.bg }}>
                  {item.image.src && (
                    <Image src={item.image.src} alt={item.name} width={100} height={100} style={{ objectFit: 'contain' }} />
                  )}
                </div>
                <div className="ocp-item-info">
                  <div className="ocp-item-category">{item.category}</div>
                  <div className="ocp-item-name">{extractKrName(item.name)}</div>
                  <div className="ocp-item-badges">
                    {item.volume && <span className="ocp-item-badge">{item.volume}</span>}
                    {item.type === 'subscription' && item.period && (
                      <span className="ocp-item-badge">정기배송 {item.period}</span>
                    )}
                    <span className="ocp-item-qty">수량 {item.qty}개</span>
                    <span className="ocp-item-price">{formatPrice(item.priceNum * item.qty)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ocp-actions">
            <Link href="/shop" className="ocp-btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              쇼핑 계속하기
            </Link>
            <button className="ocp-btn-secondary" onClick={() => router.push('/mypage')}>
              주문 내역 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
