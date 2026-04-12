/* ══════════════════════════════════════════
   InputIcons — 인풋 필드 공통 아이콘
   ClearIcon (circle-x_fill), EyeOpenIcon, EyeClosedIcon
   ══════════════════════════════════════════ */

export function ClearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12,3C7.1,3,3,7,3,12s4.1,9,9,9,9-4,9-9S17,3,12,3ZM15.7,14.3c.4.4.4,1,0,1.4-.4.4-.5.3-.7.3s-.5,0-.7-.3l-2.3-2.3-2.3,2.3c-.2.2-.5.3-.7.3s-.5,0-.7-.3c-.4-.4-.4-1,0-1.4l2.3-2.3-2.3-2.3c-.4-.4-.4-1,0-1.4.4-.4,1-.4,1.4,0l2.3,2.3,2.3-2.3c.4-.4,1-.4,1.4,0,.4.4.4,1,0,1.4l-2.3,2.3,2.3,2.3Z" />
    </svg>
  );
}

export function EyeOpenIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.1,12.3c0-.2,0-.5,0-.7,2.3-5.5,8.5-8.1,14-5.8,2.6,1.1,4.7,3.2,5.8,5.8,0,.2,0,.5,0,.7-2.3,5.5-8.5,8.1-14,5.8-2.6-1.1-4.7-3.2-5.8-5.8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeClosedIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.7,5.1c4.8-.6,9.4,2.1,11.2,6.6,0,.2,0,.5,0,.7-.4.9-.9,1.7-1.4,2.5" />
      <path d="M14.1,14.2c-1.2,1.2-3.1,1.1-4.2,0-1.1-1.2-1.1-3,0-4.2" />
      <path d="M17.5,17.5c-5.1,3-11.7,1.3-14.7-3.8-.3-.4-.5-.9-.7-1.4,0-.2,0-.5,0-.7.9-2.2,2.4-4,4.4-5.1" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
