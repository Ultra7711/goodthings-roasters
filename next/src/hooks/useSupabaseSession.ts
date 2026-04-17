/* ══════════════════════════════════════════
   useSupabaseSession  (ADR-004 Step C)
   Supabase session 을 클라이언트에서 구독하는 경량 훅.

   설계:
   - 모듈 스코프 싱글톤 캐시 + onAuthStateChange 1회 구독
   - useSyncExternalStore 로 React 18 concurrent safe
   - SSR snapshot 은 isLoading=true · session=null

   INITIAL_SESSION 이벤트 수신 전까지 isLoading=true 로 유지.
   소비처는 isLoading 중 "가드/리디렉트" 결정을 보류해야 함.
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type SessionSnapshot = {
  session: Session | null;
  isLoading: boolean;
};

const SERVER_SNAPSHOT: SessionSnapshot = { session: null, isLoading: true };

let currentSnapshot: SessionSnapshot = { session: null, isLoading: true };
const listeners = new Set<() => void>();
let subscribed = false;

function emit() {
  listeners.forEach((l) => l());
}

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSnapshot = { session, isLoading: false };
    emit();
  });
}

function subscribe(listener: () => void) {
  ensureSubscribed();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SessionSnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): SessionSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * 훅 밖(mutation fn 등)에서 현재 session 스냅샷을 읽어야 할 때.
 * React 렌더 사이클과 무관하게 최신 값을 반환.
 */
export function getSessionSnapshot() {
  ensureSubscribed();
  return {
    session: currentSnapshot.session,
    user: currentSnapshot.session?.user ?? null,
    isLoggedIn: !!currentSnapshot.session,
    isLoading: currentSnapshot.isLoading,
  };
}

/**
 * Supabase session 구독 훅.
 * - `isLoggedIn`: `session` 유무
 * - `user`: session.user (없으면 null)
 * - `isLoading`: INITIAL_SESSION 이벤트 수신 전 true
 */
export function useSupabaseSession() {
  const snap = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    session: snap.session,
    user: snap.session?.user ?? null,
    isLoggedIn: !!snap.session,
    isLoading: snap.isLoading,
  };
}
