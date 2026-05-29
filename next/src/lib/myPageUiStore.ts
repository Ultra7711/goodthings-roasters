/* ══════════════════════════════════════════
   myPageUiStore — 마이페이지 UI state 외부 store

   설계 의도 (S118):
   - React 19 Activity preserve 모드에서 /mypage hidden 전환 시 useState
     인스턴스가 보존됨 → visible 전환 후 paint 1 에 보존된 상태로 그려짐
     → useLayoutEffect 의 setState false 적용 → paint 2 에서 닫힌 상태 →
     CSS max-height transition (600px→0) 재생되어 "닫힘 애니메이션" 어색함.
   - 해결: UI state 를 외부 store 로 격리. mount/unmount 와 무관하게 singleton
     보존. 라우트 변경 시점(`gtr:route-change`) 에 reset → 다음 진입 시 paint 1
     부터 default 보장.
   - timing: NavigationVisibilityGate 의 dispatch 는 새 페이지 paint 후 useEffect
     단계에서 발생. 따라서 "leave-reset" 으로 동작 — /mypage→/X 이동 시 X 페이지
     paint 후 store reset → 다음 /mypage 진입 시 default.
   - menuLikesStore 패턴 그대로 차용 (S116). 새 패턴 도입 아님.

   대상 state (11개):
     아코디언: isAddrOpen, isPwOpen, subEditId, subCycleEdit, isCycleDropdownOpen
     모달:     isWithdrawOpen, skipConfirmSubId, cancelConfirmSubId, pauseConfirmSubId
     컬렉션:   openOrders (Set)

   HMR 보호: globalThis 에 store 인스턴스 보존.
   ══════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';
import type { SubscriptionCycle } from '@/types/subscription';

type Listener = () => void;

type State = {
  isAddrOpen: boolean;
  isPwOpen: boolean;
  isEmailOpen: boolean;
  subEditId: string | null;
  subCycleEdit: SubscriptionCycle | null;
  isCycleDropdownOpen: boolean;
  isWithdrawOpen: boolean;
  skipConfirmSubId: string | null;
  cancelConfirmSubId: string | null;
  pauseConfirmSubId: string | null;
  openOrders: Set<string>;
};

type StoreInternal = {
  state: State;
  listeners: Set<Listener>;
};

const STORE_KEY = '__gtr_my_page_ui_store__';

const INITIAL_STATE: State = {
  isAddrOpen: false,
  isPwOpen: false,
  isEmailOpen: false,
  subEditId: null,
  subCycleEdit: null,
  isCycleDropdownOpen: false,
  isWithdrawOpen: false,
  skipConfirmSubId: null,
  cancelConfirmSubId: null,
  pauseConfirmSubId: null,
  openOrders: new Set<string>(),
};

function getStore(): StoreInternal {
  const g = globalThis as unknown as Record<string, StoreInternal | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      state: { ...INITIAL_STATE, openOrders: new Set<string>() },
      listeners: new Set<Listener>(),
    };
  }
  return g[STORE_KEY]!;
}

function emit() {
  const store = getStore();
  store.listeners.forEach((l) => l());
}

function setState(updater: (s: State) => State) {
  const store = getStore();
  store.state = updater(store.state);
  emit();
}

export function subscribe(listener: Listener): () => void {
  const store = getStore();
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

export function getSnapshot(): State {
  return getStore().state;
}

const SERVER_SNAPSHOT: State = {
  ...INITIAL_STATE,
  openOrders: new Set<string>(),
};

export function getServerSnapshot(): State {
  return SERVER_SNAPSHOT;
}

/* ════════════════════════════════════════
   Actions
   ════════════════════════════════════════ */

export function setAddrOpen(open: boolean) {
  setState((s) => (s.isAddrOpen === open ? s : { ...s, isAddrOpen: open }));
}

export function setPwOpen(open: boolean) {
  setState((s) => (s.isPwOpen === open ? s : { ...s, isPwOpen: open }));
}

export function setEmailOpen(open: boolean) {
  setState((s) => (s.isEmailOpen === open ? s : { ...s, isEmailOpen: open }));
}

export function setSubEditId(id: string | null) {
  setState((s) => (s.subEditId === id ? s : { ...s, subEditId: id }));
}

export function setSubCycleEdit(cycle: SubscriptionCycle | null) {
  setState((s) => (s.subCycleEdit === cycle ? s : { ...s, subCycleEdit: cycle }));
}

export function setCycleDropdownOpen(open: boolean) {
  setState((s) => (s.isCycleDropdownOpen === open ? s : { ...s, isCycleDropdownOpen: open }));
}

export function toggleCycleDropdownOpen() {
  setState((s) => ({ ...s, isCycleDropdownOpen: !s.isCycleDropdownOpen }));
}

export function setWithdrawOpen(open: boolean) {
  setState((s) => (s.isWithdrawOpen === open ? s : { ...s, isWithdrawOpen: open }));
}

export function setSkipConfirmSubId(id: string | null) {
  setState((s) => (s.skipConfirmSubId === id ? s : { ...s, skipConfirmSubId: id }));
}

export function setCancelConfirmSubId(id: string | null) {
  setState((s) => (s.cancelConfirmSubId === id ? s : { ...s, cancelConfirmSubId: id }));
}

export function setPauseConfirmSubId(id: string | null) {
  setState((s) => (s.pauseConfirmSubId === id ? s : { ...s, pauseConfirmSubId: id }));
}

export function toggleOrder(num: string) {
  setState((s) => {
    const next = new Set(s.openOrders);
    if (next.has(num)) next.delete(num);
    else next.add(num);
    return { ...s, openOrders: next };
  });
}

export function resetMyPageUi() {
  setState(() => ({ ...INITIAL_STATE, openOrders: new Set<string>() }));
}

/* ════════════════════════════════════════
   라우트 변경 시 자동 reset (모든 detail 대상).
   /mypage 에서 다른 페이지로 이동 시 store reset → 다음 /mypage 진입 시 default.
   /X → /Y 같은 무관 이동도 reset 호출되지만, 이미 default 라면 no-op 동등 (객체
   레퍼런스만 갱신, 구독자 없으면 영향 없음).
   listener 등록은 모듈 평가 시점 1회 (브라우저 환경에서만).
   ════════════════════════════════════════ */
function registerRouteChangeListener() {
  if (typeof window === 'undefined') return;
  const g = globalThis as unknown as { __gtr_my_page_ui_store_listener__?: boolean };
  if (g.__gtr_my_page_ui_store_listener__) return;
  g.__gtr_my_page_ui_store_listener__ = true;

  window.addEventListener('gtr:route-change', () => {
    resetMyPageUi();
  });
}
registerRouteChangeListener();

/* ════════════════════════════════════════
   React hooks — useSyncExternalStore selector
   ════════════════════════════════════════ */

export function useMyPageAddrOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.isAddrOpen,
    () => false,
  );
}

export function useMyPagePwOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.isPwOpen,
    () => false,
  );
}

export function useMyPageEmailOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.isEmailOpen,
    () => false,
  );
}

export function useMyPageSubEditId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.subEditId,
    () => null,
  );
}

export function useMyPageSubCycleEdit(): SubscriptionCycle | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.subCycleEdit,
    () => null,
  );
}

export function useMyPageCycleDropdownOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.isCycleDropdownOpen,
    () => false,
  );
}

export function useMyPageWithdrawOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.isWithdrawOpen,
    () => false,
  );
}

export function useMyPageSkipConfirmSubId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.skipConfirmSubId,
    () => null,
  );
}

export function useMyPageCancelConfirmSubId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.cancelConfirmSubId,
    () => null,
  );
}

export function useMyPagePauseConfirmSubId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.pauseConfirmSubId,
    () => null,
  );
}

export function useMyPageOpenOrders(): Set<string> {
  return useSyncExternalStore(
    subscribe,
    () => getStore().state.openOrders,
    () => SERVER_SNAPSHOT.openOrders,
  );
}

