const pptxgen = require("pptxgenjs");
const pres = new pptxgen();

pres.layout = "LAYOUT_16x9";
pres.author = "Good Things Roasters";
pres.title = "GTR Research & Design Direction";

// ── GTR Design System Colors (Warm-shifted B&W) ──
const C = {
  black: "1C1B19",
  dark: "333330",
  mid: "6B6963",
  gray: "9C9890",
  light: "B8B4AD",
  line: "D9D6D2",
  bg2: "F2F1EF",
  bg: "FAFAF8",
  white: "FFFFFF",
  oak: "7A6B52",
  oakLight: "E8DFD2",
  cream: "B8943F",
  creamLight: "F5EFE0",
  stone: "4A4845",
  stoneTint: "D9D6D2",
};

// ── Helper: fresh shadow objects ──
const cardShadow = () => ({ type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.06 });
const softShadow = () => ({ type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.08 });

// ══════════════════════════════════════════════
// SLIDE 1: Title
// ══════════════════════════════════════════════
let s1 = pres.addSlide();
s1.background = { color: C.black };
s1.addText("RESEARCH & DESIGN DIRECTION", {
  x: 0.8, y: 1.4, w: 8.4, h: 0.4,
  fontSize: 11, fontFace: "Inter", color: C.gray, charSpacing: 6, bold: true, margin: 0
});
s1.addText("Good Things\nRoasters", {
  x: 0.8, y: 1.9, w: 8.4, h: 2.2,
  fontSize: 48, fontFace: "Inter", color: C.bg, bold: true, lineSpacingMultiple: 0.95, margin: 0
});
s1.addText("good things, take time", {
  x: 0.8, y: 4.2, w: 8.4, h: 0.4,
  fontSize: 14, fontFace: "Inter", color: C.mid, charSpacing: 2, margin: 0
});
s1.addText("2026.04.05", {
  x: 0.8, y: 4.8, w: 8.4, h: 0.3,
  fontSize: 10, fontFace: "Inter", color: C.stone, margin: 0
});

// ══════════════════════════════════════════════
// SLIDE 2: Agenda / Research Structure
// ══════════════════════════════════════════════
let s2 = pres.addSlide();
s2.background = { color: C.bg };
s2.addText("OVERVIEW", {
  x: 0.8, y: 0.5, w: 8.4, h: 0.3,
  fontSize: 10, fontFace: "Inter", color: C.gray, charSpacing: 4, bold: true, margin: 0
});
s2.addText("리서치 구조", {
  x: 0.8, y: 0.9, w: 8.4, h: 0.6,
  fontSize: 28, fontFace: "Inter", color: C.black, bold: true, margin: 0
});
s2.addText("4개 트랙의 리서치를 종합하여 디자인 방향성을 도출합니다.", {
  x: 0.8, y: 1.6, w: 8.4, h: 0.4,
  fontSize: 13, fontFace: "Inter", color: C.mid, margin: 0
});

const tracks = [
  { label: "A", desc: "경쟁사 벤치마킹" },
  { label: "B", desc: "UX 벤치마킹" },
  { label: "C", desc: "브랜드 포지셔닝" },
  { label: "D", desc: "타겟 유저" },
];
tracks.forEach((t, i) => {
  const x = 0.8 + i * 2.2;
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y: 2.3, w: 2.0, h: 1.4,
    fill: { color: C.white }, rectRadius: 0.08, shadow: cardShadow()
  });
  s2.addText(t.label, {
    x, y: 2.45, w: 2.0, h: 0.6,
    fontSize: 28, fontFace: "Inter", color: C.black, bold: true, align: "center", margin: 0
  });
  s2.addText(t.desc, {
    x, y: 3.1, w: 2.0, h: 0.4,
    fontSize: 11, fontFace: "Inter", color: C.mid, align: "center", margin: 0
  });
});

// Flow: Research → Insight → Design → Photoshop
const flowItems = ["리서치 4트랙", "인사이트 도출", "디자인 방향성 확정", "포토샵 디자인"];
flowItems.forEach((item, i) => {
  const x = 0.8 + i * 2.4;
  const isPrimary = i === 2;
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y: 4.3, w: 2.0, h: 0.5,
    fill: { color: isPrimary ? C.black : C.white },
    line: { color: C.line, width: isPrimary ? 0 : 1 },
    rectRadius: 0.06
  });
  s2.addText(item, {
    x, y: 4.3, w: 2.0, h: 0.5,
    fontSize: 10, fontFace: "Inter", color: isPrimary ? C.bg : C.black, bold: isPrimary, align: "center", valign: "middle", margin: 0
  });
  if (i < flowItems.length - 1) {
    s2.addText("→", {
      x: x + 2.0, y: 4.3, w: 0.4, h: 0.5,
      fontSize: 12, fontFace: "Inter", color: C.light, align: "center", valign: "middle", margin: 0
    });
  }
});

// ══════════════════════════════════════════════
// SLIDE 3: Track A Divider
// ══════════════════════════════════════════════
function addDividerSlide(trackLabel, title, subtitle) {
  let s = pres.addSlide();
  s.background = { color: C.black };
  s.addText(trackLabel, {
    x: 0.8, y: 1.8, w: 8.4, h: 0.3,
    fontSize: 11, fontFace: "Inter", color: C.gray, charSpacing: 4, bold: true, margin: 0
  });
  s.addText(title, {
    x: 0.8, y: 2.2, w: 8.4, h: 0.8,
    fontSize: 36, fontFace: "Inter", color: C.bg, bold: true, margin: 0
  });
  s.addText(subtitle, {
    x: 0.8, y: 3.2, w: 8.4, h: 0.5,
    fontSize: 13, fontFace: "Inter", color: C.mid, margin: 0
  });
  return s;
}

addDividerSlide("TRACK A", "경쟁사 벤치마킹", "해외 스페셜티 커피 브랜드 5곳의 웹사이트를 8개 축으로 분석");

// ══════════════════════════════════════════════
// SLIDE 4: Track A — Competitors
// ══════════════════════════════════════════════
let s4 = pres.addSlide();
s4.background = { color: C.bg };
s4.addText("TRACK A — 경쟁사 벤치마킹", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s4.addText("분석 대상", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});
s4.addText("GTR 목표에 가장 근접한 해외 상위 브랜드 5곳을 선정했습니다.", {
  x: 0.8, y: 1.35, w: 8.4, h: 0.35,
  fontSize: 12, fontFace: "Inter", color: C.mid, margin: 0
});

const competitors = [
  { name: "Onyx Coffee Lab", desc: "럭셔리 에디토리얼\n커스텀 애니메이션\n최상위 프리미엄" },
  { name: "Blue Bottle", desc: "셀링 미니멀\n쇼핑 전환 극최적화\n대중적 프리미엄" },
  { name: "% Arabica", desc: "극단적 미니멀\nB&W 그레이스케일\n영화적 몰입" },
  { name: "Onibus Coffee", desc: "일본식 정갈함\n클린 산세리프\n따뜻한 커넥팅" },
  { name: "Verve Coffee", desc: "아티자날 크래프트\n어스 톤 팔레트\n라이프스타일" },
];
competitors.forEach((c, i) => {
  const x = 0.8 + i * 1.76;
  s4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y: 2.0, w: 1.6, h: 2.8,
    fill: { color: C.white }, rectRadius: 0.06, shadow: cardShadow()
  });
  s4.addText(c.name, {
    x: x + 0.12, y: 2.2, w: 1.36, h: 0.5,
    fontSize: 11, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s4.addText(c.desc, {
    x: x + 0.12, y: 2.8, w: 1.36, h: 1.8,
    fontSize: 10, fontFace: "Inter", color: C.mid, lineSpacingMultiple: 1.5, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 5: Track A — Visual Comparison Table
// ══════════════════════════════════════════════
let s5 = pres.addSlide();
s5.background = { color: C.bg };
s5.addText("TRACK A — 비주얼 디자인", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s5.addText("비주얼 비교", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const headerOpts = { fontSize: 10, fontFace: "Inter", color: C.black, bold: true, fill: { color: C.bg2 } };
const cellOpts = { fontSize: 9, fontFace: "Inter", color: C.mid, fill: { color: C.white } };
const hlOpts = { fontSize: 9, fontFace: "Inter", color: C.black, bold: true, fill: { color: C.creamLight } };

const tableRows = [
  [
    { text: "항목", options: headerOpts },
    { text: "Onyx", options: headerOpts },
    { text: "Blue Bottle", options: headerOpts },
    { text: "% Arabica", options: headerOpts },
    { text: "Onibus", options: headerOpts },
    { text: "Verve", options: headerOpts },
  ],
  [
    { text: "색상", options: { ...cellOpts, bold: true, color: C.black } },
    { text: "크림 + 버건디", options: cellOpts },
    { text: "화이트 + 시그니처 블루", options: cellOpts },
    { text: "B&W 그레이스케일", options: cellOpts },
    { text: "화이트 + 뮤트", options: cellOpts },
    { text: "세이지 그린 + 크림", options: cellOpts },
  ],
  [
    { text: "이미지 톤", options: { ...cellOpts, bold: true, color: C.black } },
    { text: "에디토리얼급", options: cellOpts },
    { text: "밝고 깔끔, 자연광", options: cellOpts },
    { text: "필름적 질감", options: cellOpts },
    { text: "클린, 프로덕트", options: cellOpts },
    { text: "따뜻하고 촉각적", options: cellOpts },
  ],
  [
    { text: "여백", options: { ...cellOpts, bold: true, color: C.black } },
    { text: "넉넉 (고급 호흡)", options: cellOpts },
    { text: "매우 넉넉", options: cellOpts },
    { text: "극단적 (공간=디자인)", options: cellOpts },
    { text: "적절 (정갈)", options: cellOpts },
    { text: "균형", options: cellOpts },
  ],
  [
    { text: "전체 인상", options: hlOpts },
    { text: "럭셔리 에디토리얼", options: hlOpts },
    { text: "셀링 미니멀", options: hlOpts },
    { text: "극미니멀, 교토", options: hlOpts },
    { text: "모던, 일본 정갈", options: hlOpts },
    { text: "아티자날 크래프트", options: hlOpts },
  ],
];

s5.addTable(tableRows, {
  x: 0.8, y: 1.5, w: 8.4,
  colW: [1.2, 1.44, 1.44, 1.44, 1.44, 1.44],
  border: { pt: 0.5, color: C.line },
  rowH: [0.35, 0.35, 0.35, 0.35, 0.4],
});

// Quote
s5.addShape(pres.shapes.RECTANGLE, {
  x: 0.8, y: 3.9, w: 8.4, h: 0.7,
  fill: { color: C.creamLight }
});
s5.addShape(pres.shapes.RECTANGLE, {
  x: 0.8, y: 3.9, w: 0.06, h: 0.7,
  fill: { color: C.oak }
});
s5.addText("% Arabica의 B&W 클린함 + Onibus의 정갈한 따뜻함 = GTR의 방향", {
  x: 1.1, y: 3.9, w: 7.9, h: 0.7,
  fontSize: 12, fontFace: "Inter", color: C.black, bold: true, valign: "middle", margin: 0
});

// ══════════════════════════════════════════════
// SLIDE 6: Track A — Key Insights
// ══════════════════════════════════════════════
let s6 = pres.addSlide();
s6.background = { color: C.bg };
s6.addText("TRACK A — 핵심 인사이트", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s6.addText("5가지 핵심 배움", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const insights = [
  { title: "B&W 클린 + 따뜻함의 균형", desc: "이미지 톤에서 따뜻함, 레이아웃/타이포는 차갑게 유지" },
  { title: "히어로 영상 = 최강 무기", desc: "씬 전환 호흡, 색보정 일관성이 전체 인상을 결정" },
  { title: "풍미 노트 그래픽 = 미개척 영역", desc: "모든 경쟁사가 텍스트 나열. 인터랙티브 시각화로 업계 최초 차별화" },
  { title: "카페 메뉴 → 상품 순서는 합리적", desc: "매장 방문 유도 1차 목표에 부합하는 현재 섹션 순서" },
  { title: "인터랙션 수준은 이미 경쟁력 있음", desc: "blur→sharp, fade-in stagger 등 Onyx에 근접. 과하지 않게 통제만 잘 하면 OK" },
];
insights.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 4.3;
  const y = 1.5 + row * 1.2;
  const w = i === 4 ? 8.4 : 4.0;

  s6.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h: 1.0,
    fill: { color: C.white }, shadow: cardShadow()
  });
  s6.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.05, h: 1.0,
    fill: { color: C.oak }
  });
  s6.addText(`${i + 1}. ${item.title}`, {
    x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.35,
    fontSize: 12, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s6.addText(item.desc, {
    x: x + 0.2, y: y + 0.5, w: w - 0.4, h: 0.4,
    fontSize: 10, fontFace: "Inter", color: C.mid, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 7: Track B Divider
// ══════════════════════════════════════════════
addDividerSlide("TRACK B", "UX 벤치마킹", "상품 구매 · 구독 · 카페 메뉴 · 브랜드 스토리 — 4개 플로우 분석");

// ══════════════════════════════════════════════
// SLIDE 8: Track B — Differentiation Opportunities
// ══════════════════════════════════════════════
let s8 = pres.addSlide();
s8.background = { color: C.bg };
s8.addText("TRACK B — 종합", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s8.addText("경쟁사 미개척 → GTR 차별화 기회", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const opps = [
  { title: "온라인 카페 메뉴  ★★★", desc: "경쟁사 전무. 이미지 중심 카테고리별 메뉴\n+ 버터떡 킬러 메뉴 강조", status: "경쟁사 0/5 구현" },
  { title: "풍미 노트 시각화  ★★★", desc: "레이더 차트, 로스팅 게이지, 플레이버 아이콘\n으로 업계 최초 수준", status: "경쟁사 최상위: 텍스트 나열 (Onyx)" },
  { title: "구독 vs 일반 즉시 비교  ★★☆", desc: "상품 상세 탭 전환으로\n가격·혜택 시각화", status: "경쟁사 0/5 제대로 구현" },
  { title: "베이커리 콘텐츠  ★★★", desc: "갓 구운 빵 비주얼\n버터떡 = 매장 방문 트리거", status: "GTR만의 독자 콘텐츠" },
];
opps.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 4.3;
  const y = 1.5 + row * 1.9;

  s8.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 4.0, h: 1.7,
    fill: { color: C.white }, shadow: cardShadow()
  });
  s8.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.05, h: 1.7,
    fill: { color: C.oak }
  });
  s8.addText(item.title, {
    x: x + 0.2, y: y + 0.12, w: 3.6, h: 0.35,
    fontSize: 12, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s8.addText(item.desc, {
    x: x + 0.2, y: y + 0.55, w: 3.6, h: 0.7,
    fontSize: 10, fontFace: "Inter", color: C.mid, lineSpacingMultiple: 1.4, margin: 0
  });
  s8.addText(item.status, {
    x: x + 0.2, y: y + 1.3, w: 3.6, h: 0.25,
    fontSize: 9, fontFace: "Inter", color: C.gray, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 9: Track C Divider
// ══════════════════════════════════════════════
addDividerSlide("TRACK C", "브랜드 포지셔닝", "경쟁사 대비 GTR의 위치를 정의하고 핵심 메시지를 도출");

// ══════════════════════════════════════════════
// SLIDE 10: Track C — Brand Personality Spectrum
// ══════════════════════════════════════════════
let s10 = pres.addSlide();
s10.background = { color: C.bg };
s10.addText("TRACK C — 브랜드 성격", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s10.addText("브랜드 성격 스펙트럼", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});
s10.addText("각 축에서 GTR이 위치하는 지점", {
  x: 0.8, y: 1.35, w: 8.4, h: 0.3,
  fontSize: 12, fontFace: "Inter", color: C.mid, margin: 0
});

const spectrums = [
  { left: "차가운", right: "따뜻한", pos: 62 },
  { left: "미니멀", right: "풍부한", pos: 75 },
  { left: "빠른", right: "느린", pos: 75 },
  { left: "공격적", right: "절제된", pos: 80 },
  { left: "젊은", right: "성숙한", pos: 58 },
  { left: "대중적", right: "전문적", pos: 55 },
];
spectrums.forEach((sp, i) => {
  const y = 1.9 + i * 0.5;
  const barX = 2.2;
  const barW = 5.6;
  // Left label
  s10.addText(sp.left, {
    x: 0.8, y, w: 1.3, h: 0.35,
    fontSize: 10, fontFace: "Inter", color: C.gray, align: "right", valign: "middle", margin: 0
  });
  // Right label
  s10.addText(sp.right, {
    x: 8.0, y, w: 1.3, h: 0.35,
    fontSize: 10, fontFace: "Inter", color: C.gray, align: "left", valign: "middle", margin: 0
  });
  // Bar track
  s10.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: barX, y: y + 0.14, w: barW, h: 0.07,
    fill: { color: C.line }, rectRadius: 0.035
  });
  // Marker dot
  const dotX = barX + (barW * sp.pos / 100) - 0.1;
  s10.addShape(pres.shapes.OVAL, {
    x: dotX, y: y + 0.07, w: 0.21, h: 0.21,
    fill: { color: C.black }
  });
});

// Quote
s10.addShape(pres.shapes.RECTANGLE, {
  x: 0.8, y: 4.8, w: 8.4, h: 0.6,
  fill: { color: C.creamLight }
});
s10.addShape(pres.shapes.RECTANGLE, {
  x: 0.8, y: 4.8, w: 0.06, h: 0.6,
  fill: { color: C.oak }
});
s10.addText([
  { text: '"모던한 정갈함 속의 따뜻함"  ', options: { bold: true, fontSize: 13, color: C.black } },
  { text: '— 차갑지도, 과하지도 않은 단정한 따뜻함', options: { fontSize: 11, color: C.mid } },
], {
  x: 1.1, y: 4.8, w: 7.9, h: 0.6,
  fontFace: "Inter", valign: "middle", margin: 0
});

// ══════════════════════════════════════════════
// SLIDE 11: Track C — Brand Voice
// ══════════════════════════════════════════════
let s11 = pres.addSlide();
s11.background = { color: C.bg };
s11.addText("TRACK C — 보이스 & 톤", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s11.addText("브랜드 보이스", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

// "이렇게" section
s11.addText("이렇게", {
  x: 0.8, y: 1.5, w: 4.0, h: 0.35,
  fontSize: 14, fontFace: "Inter", color: C.black, bold: true, margin: 0
});
const doRows = [
  ["어조", "차분하고 자신감 있는, 과시하지 않는"],
  ["문장", '짧고 여운이 있는 · "천천히 내린 한 잔."'],
  ["영문", 'soMunja 선호, 간결 · "good things, take time"'],
  ["한글", '존댓말 기반, 부드러운 · "만나보세요"'],
];
const doTable = doRows.map(r => [
  { text: r[0], options: { fontSize: 10, fontFace: "Inter", color: C.black, bold: true, fill: { color: C.bg2 } } },
  { text: r[1], options: { fontSize: 10, fontFace: "Inter", color: C.mid, fill: { color: C.white } } },
]);
s11.addTable(doTable, {
  x: 0.8, y: 1.95, w: 4.0,
  colW: [0.8, 3.2],
  border: { pt: 0.5, color: C.line },
  rowH: [0.38, 0.38, 0.38, 0.38],
});

// "이건 아님" section
s11.addText("이건 아님", {
  x: 5.2, y: 1.5, w: 4.0, h: 0.35,
  fontSize: 14, fontFace: "Inter", color: "CC4444", bold: true, margin: 0
});
const dontRows = [
  ["급박", '"지금 바로!", "한정 수량!"'],
  ["과장", '"최고급 프리미엄 원두!"'],
  ["힙스터", '"갓생", 과도한 이모지'],
  ["올캡", '"THE BEST COFFEE EVER"'],
];
const dontTable = dontRows.map(r => [
  { text: r[0], options: { fontSize: 10, fontFace: "Inter", color: C.black, bold: true, fill: { color: "FFF5F5" } } },
  { text: r[1], options: { fontSize: 10, fontFace: "Inter", color: C.mid, fill: { color: C.white } } },
]);
s11.addTable(dontTable, {
  x: 5.2, y: 1.95, w: 4.0,
  colW: [0.8, 3.2],
  border: { pt: 0.5, color: C.line },
  rowH: [0.38, 0.38, 0.38, 0.38],
});

// ══════════════════════════════════════════════
// SLIDE 12: Track C — Message Hierarchy
// ══════════════════════════════════════════════
let s12 = pres.addSlide();
s12.background = { color: C.bg };
s12.addText("TRACK C — 메시지 프레임워크", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s12.addText("메시지 계층", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const msgLevels = [
  { level: "L0", color: C.black, title: "철학 — 웹사이트 전체에 스며드는 결", desc: '"good things, take time" → 직접 말하지 않고, 페이싱·여백·인터랙션으로 체감' },
  { level: "L1", color: C.dark, title: "핵심 메시지 — 히어로 + 스토리", desc: '"좋은 원두, 좋은 추출, 좋은 시간" → 히어로 영상으로 압축 전달' },
  { level: "L2", color: C.mid, title: "섹션별 메시지", desc: '카페 메뉴 → "오늘, 매장에서"  |  상품 → "집에서도 같은 맛을"  |  구독 → "매달, 문 앞까지"' },
  { level: "L3", color: C.gray, title: "상세 메시지 — 서브 페이지, 상품 상세", desc: "원두별 원산지·프로세스·풍미 스토리, MANO 머신, 베이커리 철학" },
];
msgLevels.forEach((m, i) => {
  const y = 1.5 + i * 0.9;
  s12.addShape(pres.shapes.OVAL, {
    x: 0.8, y, w: 0.65, h: 0.65,
    fill: { color: m.color }
  });
  s12.addText(m.level, {
    x: 0.8, y, w: 0.65, h: 0.65,
    fontSize: 11, fontFace: "Inter", color: C.bg, bold: true, align: "center", valign: "middle", margin: 0
  });
  s12.addText(m.title, {
    x: 1.7, y: y + 0.02, w: 7.5, h: 0.3,
    fontSize: 13, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s12.addText(m.desc, {
    x: 1.7, y: y + 0.32, w: 7.5, h: 0.3,
    fontSize: 10, fontFace: "Inter", color: C.mid, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 13: Track D Divider
// ══════════════════════════════════════════════
addDividerSlide("TRACK D", "타겟 유저 리서치", "5개 고객 세그먼트 정의와 페르소나별 웹사이트 이용 시나리오");

// ══════════════════════════════════════════════
// SLIDE 14: Track D — Customer Segments
// ══════════════════════════════════════════════
let s14 = pres.addSlide();
s14.background = { color: C.bg };
s14.addText("TRACK D — 세그먼트", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s14.addText("고객 세그먼트", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const segHeader = [
  { text: "우선순위", options: { ...headerOpts, align: "center" } },
  { text: "세그먼트", options: headerOpts },
  { text: "매장 연결", options: { ...headerOpts, align: "center" } },
  { text: "온라인 구매", options: { ...headerOpts, align: "center" } },
  { text: "비중", options: { ...headerOpts, align: "center" } },
];
const segRows = [
  { pri: "★★★", seg: "카페 단골 / 잠재 방문객", store: "직접", online: "중간", pct: "40%", hl: true },
  { pri: "★★★", seg: "디저트·베이커리 팬", store: "직접", online: "낮음", pct: "20%", hl: true },
  { pri: "★★☆", seg: "홈브루어", store: "간접", online: "높음", pct: "20%", hl: false },
  { pri: "★★☆", seg: "선물 구매자", store: "간접", online: "높음", pct: "10%", hl: false },
  { pri: "★☆☆", seg: "커피 입문자", store: "간접", online: "중간", pct: "10%", hl: false },
];

const segTableData = [segHeader];
segRows.forEach(r => {
  const opts = r.hl ? hlOpts : cellOpts;
  segTableData.push([
    { text: r.pri, options: { ...opts, align: "center" } },
    { text: r.seg, options: r.hl ? { ...hlOpts, bold: true } : opts },
    { text: r.store, options: { ...opts, align: "center" } },
    { text: r.online, options: { ...opts, align: "center" } },
    { text: r.pct, options: { ...opts, align: "center" } },
  ]);
});

s14.addTable(segTableData, {
  x: 0.8, y: 1.5, w: 8.4,
  colW: [1.2, 2.8, 1.3, 1.3, 1.0],
  border: { pt: 0.5, color: C.line },
  rowH: [0.35, 0.4, 0.4, 0.35, 0.35, 0.35],
});

// ══════════════════════════════════════════════
// SLIDE 15: Track D — Personas
// ══════════════════════════════════════════════
let s15 = pres.addSlide();
s15.background = { color: C.bg };
s15.addText("TRACK D — 페르소나", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s15.addText("핵심 페르소나", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const personas = [
  { name: "지은 (29, 마케터)", tag: "단골", role: "주 2~3회 매장 방문 · 인스타 팔로우", need: "신메뉴 확인, 영업시간, 재확인\n인스타 → 웹사이트 → 매장 방문" },
  { name: "수빈 (33, 디자이너)", tag: "디저트", role: "카페 작업 · 빵 냄새에 재방문", need: "오늘 어떤 빵? 버터떡(킬러 메뉴)\n인스타 릴스 → 디저트 메뉴 → 방문" },
  { name: "민수 (36, 개발자)", tag: "홈브루어", role: "재택근무 · 원두 재구매", need: "원두 상세(원산지, 풍미), 분쇄 옵션\n매장 → 원두 탐색 → 구매 → 구독" },
  { name: "정원 (31, 금융)", tag: "선물", role: "지인 추천으로 발견 · 1회성 구매", need: '"센스 있어 보이는" 선물, 브랜드 신뢰\n검색 → 선물 세트 → 구매' },
];
personas.forEach((p, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 4.3;
  const y = 1.5 + row * 1.85;

  s15.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 4.0, h: 1.65,
    fill: { color: C.white }, rectRadius: 0.06, shadow: cardShadow()
  });
  // Tag
  s15.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x + 3.0, y: y + 0.12, w: 0.8, h: 0.25,
    fill: { color: C.creamLight }, rectRadius: 0.04
  });
  s15.addText(p.tag, {
    x: x + 3.0, y: y + 0.12, w: 0.8, h: 0.25,
    fontSize: 8, fontFace: "Inter", color: C.oak, bold: true, align: "center", valign: "middle", margin: 0
  });
  s15.addText(p.name, {
    x: x + 0.2, y: y + 0.12, w: 2.8, h: 0.3,
    fontSize: 13, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s15.addText(p.role, {
    x: x + 0.2, y: y + 0.45, w: 3.6, h: 0.25,
    fontSize: 10, fontFace: "Inter", color: C.gray, margin: 0
  });
  s15.addText(p.need, {
    x: x + 0.2, y: y + 0.8, w: 3.6, h: 0.7,
    fontSize: 10, fontFace: "Inter", color: C.mid, lineSpacingMultiple: 1.4, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 16: Design Direction Divider
// ══════════════════════════════════════════════
addDividerSlide("DESIGN DIRECTION", "디자인 방향성", "4개 트랙 리서치의 종합 → 비주얼 시스템 · UX 원칙 · 페이지 구조");

// ══════════════════════════════════════════════
// SLIDE 17: Brand Essence
// ══════════════════════════════════════════════
let s17 = pres.addSlide();
s17.background = { color: C.bg };
s17.addText("DESIGN DIRECTION — 에센스", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s17.addText("브랜드 에센스", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

s17.addText('"모던한 정갈함 속의 따뜻함"', {
  x: 0.8, y: 1.6, w: 8.4, h: 0.6,
  fontSize: 28, fontFace: "Inter", color: C.black, bold: true, align: "center", margin: 0
});
s17.addText("good things, take time", {
  x: 0.8, y: 2.2, w: 8.4, h: 0.3,
  fontSize: 12, fontFace: "Inter", color: C.gray, charSpacing: 2, align: "center", margin: 0
});

const essenceCards = [
  { title: "MANO", desc: "미래적 추출 장비" },
  { title: "버터떡", desc: "킬러 베이커리 메뉴" },
  { title: "공간", desc: "화이트·메탈·우드" },
  { title: "카페 메뉴", desc: "경쟁사 전무" },
  { title: "풍미", desc: "업계 최초 시각화" },
];
essenceCards.forEach((c, i) => {
  const x = 0.8 + i * 1.76;
  s17.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y: 3.0, w: 1.6, h: 1.3,
    fill: { color: C.white }, rectRadius: 0.06, shadow: cardShadow()
  });
  s17.addText(c.title, {
    x, y: 3.15, w: 1.6, h: 0.5,
    fontSize: 16, fontFace: "Inter", color: C.black, bold: true, align: "center", margin: 0
  });
  s17.addText(c.desc, {
    x, y: 3.7, w: 1.6, h: 0.35,
    fontSize: 10, fontFace: "Inter", color: C.gray, align: "center", margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 18: Conversion Priority
// ══════════════════════════════════════════════
let s18 = pres.addSlide();
s18.background = { color: C.bg };
s18.addText("DESIGN DIRECTION — 전환 목표", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s18.addText("전환 우선순위", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const priorities = [
  { num: "1", title: "매장 방문 유도", desc: "카페 메뉴, 갤러리, Come visit us, 히어로 영상", barW: 6.5, color: C.black },
  { num: "2", title: "브랜드 인지 · 충성도", desc: "히어로 영상, 스토리, 웹사이트 퀄리티", barW: 4.8, color: C.dark },
  { num: "3", title: "원두 온라인 구매", desc: "상품 상세, 풍미 그래픽, 분쇄 옵션", barW: 3.2, color: C.mid },
  { num: "4", title: "구독 전환", desc: "일반 vs 구독 비교 UI, 어나운스 프로모", barW: 2.0, color: C.gray },
];
priorities.forEach((p, i) => {
  const y = 1.6 + i * 0.9;
  s18.addShape(pres.shapes.OVAL, {
    x: 0.8, y, w: 0.5, h: 0.5,
    fill: { color: p.color }
  });
  s18.addText(p.num, {
    x: 0.8, y, w: 0.5, h: 0.5,
    fontSize: 16, fontFace: "Inter", color: C.bg, bold: true, align: "center", valign: "middle", margin: 0
  });
  s18.addText(p.title, {
    x: 1.5, y: y - 0.02, w: 3.0, h: 0.28,
    fontSize: 13, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s18.addText(p.desc, {
    x: 1.5, y: y + 0.26, w: 4.0, h: 0.22,
    fontSize: 10, fontFace: "Inter", color: C.mid, margin: 0
  });
  // Bar
  s18.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.8, y: y + 0.1, w: p.barW * 0.6, h: 0.18,
    fill: { color: p.color }, rectRadius: 0.09
  });
});

// ══════════════════════════════════════════════
// SLIDE 19: Visual System — Color & Typo
// ══════════════════════════════════════════════
let s19 = pres.addSlide();
s19.background = { color: C.bg };
s19.addText("DESIGN DIRECTION — 컬러 & 타이포", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s19.addText("비주얼 시스템", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

// Color section
s19.addText("컬러", {
  x: 0.8, y: 1.5, w: 4.0, h: 0.35,
  fontSize: 14, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const swatches = [
  { color: C.bg, label: "#FAFAF8", use: "배경 (주)", border: true },
  { color: C.bg2, label: "#F2F1EF", use: "배경 (보조)", border: true },
  { color: C.black, label: "#1C1B19", use: "텍스트 · CTA", border: false },
  { color: C.mid, label: "#6B6963", use: "보조 텍스트", border: false },
  { color: C.gray, label: "#9C9890", use: "힌트 · 비활성", border: false },
];
swatches.forEach((sw, i) => {
  const y = 2.0 + i * 0.55;
  s19.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y, w: 0.4, h: 0.4,
    fill: { color: sw.color }, rectRadius: 0.04,
    line: sw.border ? { color: C.line, width: 0.5 } : undefined,
  });
  s19.addText(sw.label, {
    x: 1.35, y, w: 1.2, h: 0.4,
    fontSize: 10, fontFace: "Inter", color: C.black, bold: true, valign: "middle", margin: 0
  });
  s19.addText(sw.use, {
    x: 2.6, y, w: 2.0, h: 0.4,
    fontSize: 10, fontFace: "Inter", color: C.gray, valign: "middle", margin: 0
  });
});
s19.addText("액센트 컬러 없음 — 이미지의 따뜻한 색감이 유일한 컬러", {
  x: 0.8, y: 4.8, w: 4.0, h: 0.3,
  fontSize: 9, fontFace: "Inter", color: C.mid, bold: true, margin: 0
});

// Typography section
s19.addText("타이포그래피", {
  x: 5.2, y: 1.5, w: 4.0, h: 0.35,
  fontSize: 14, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const typoTable = [
  [
    { text: "요소", options: headerOpts },
    { text: "크기", options: headerOpts },
    { text: "Weight", options: headerOpts },
  ],
  [{ text: "H1", options: { ...cellOpts, bold: true, color: C.black } }, { text: "48px", options: cellOpts }, { text: "600", options: cellOpts }],
  [{ text: "H2", options: { ...cellOpts, bold: true, color: C.black } }, { text: "32px", options: cellOpts }, { text: "600", options: cellOpts }],
  [{ text: "H3", options: { ...cellOpts, bold: true, color: C.black } }, { text: "24px", options: cellOpts }, { text: "500", options: cellOpts }],
  [{ text: "본문", options: { ...cellOpts, bold: true, color: C.black } }, { text: "16px", options: cellOpts }, { text: "400", options: cellOpts }],
  [{ text: "라벨", options: { ...cellOpts, bold: true, color: C.black } }, { text: "13px", options: cellOpts }, { text: "500", options: cellOpts }],
  [{ text: "CTA", options: { ...cellOpts, bold: true, color: C.black } }, { text: "14px", options: cellOpts }, { text: "500", options: cellOpts }],
];
s19.addTable(typoTable, {
  x: 5.2, y: 2.0, w: 4.0,
  colW: [1.0, 1.5, 1.5],
  border: { pt: 0.5, color: C.line },
  rowH: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
});
s19.addText("EN: Inter 300–600  |  KR: Pretendard Variable 300–600", {
  x: 5.2, y: 4.3, w: 4.0, h: 0.3,
  fontSize: 9, fontFace: "Inter", color: C.mid, margin: 0
});

// ══════════════════════════════════════════════
// SLIDE 20: UX Principles
// ══════════════════════════════════════════════
let s20 = pres.addSlide();
s20.background = { color: C.bg };
s20.addText("DESIGN DIRECTION — UX 원칙", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s20.addText("7가지 UX 설계 원칙", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const uxPrinciples = [
  { num: "01", title: "보여주되, 설명하지 않는다", desc: "이미지·영상이 텍스트보다 먼저" },
  { num: "02", title: "여유로운 페이싱", desc: '"take time" 체현. 120px+ 여백' },
  { num: "03", title: "감각의 트리거", desc: "냄새·촉감을 시각으로 환기" },
  { num: "04", title: "정보의 계층화", desc: "카드 → 상세 → 추가" },
  { num: "05", title: "구매 허들 최소화", desc: "분쇄 옵션 4종, 구독 토글" },
  { num: "06", title: "매장 방문 = 궁극의 CTA", desc: '모든 경로가 "가보고 싶다"로 수렴' },
  { num: "07", title: "디테일이 신뢰를 만든다", desc: "호버 섬세함, 자간 조정, 풍미 시각화" },
];
uxPrinciples.forEach((p, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.8 + col * 3.0;
  const y = 1.5 + row * 1.4;
  const w = (i === 6) ? 8.4 : 2.8;

  s20.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h: 1.2,
    fill: { color: C.white }, rectRadius: 0.06, shadow: cardShadow()
  });
  s20.addText(p.num, {
    x: x + 0.15, y: y + 0.1, w: 0.5, h: 0.25,
    fontSize: 10, fontFace: "Inter", color: C.oak, bold: true, margin: 0
  });
  s20.addText(p.title, {
    x: x + 0.15, y: y + 0.4, w: w - 0.3, h: 0.3,
    fontSize: 12, fontFace: "Inter", color: C.black, bold: true, margin: 0
  });
  s20.addText(p.desc, {
    x: x + 0.15, y: y + 0.72, w: w - 0.3, h: 0.35,
    fontSize: 10, fontFace: "Inter", color: C.mid, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 21: Page Structure
// ══════════════════════════════════════════════
let s21 = pres.addSlide();
s21.background = { color: C.bg };
s21.addText("DESIGN DIRECTION — 페이지 구조", {
  x: 0.8, y: 0.4, w: 8.4, h: 0.25,
  fontSize: 9, fontFace: "Inter", color: C.gray, charSpacing: 3, margin: 0
});
s21.addText("메인 페이지 섹션 순서 (확정)", {
  x: 0.8, y: 0.75, w: 8.4, h: 0.5,
  fontSize: 26, fontFace: "Inter", color: C.black, bold: true, margin: 0
});

const pageHeader = [
  { text: "#", options: { ...headerOpts, align: "center" } },
  { text: "섹션", options: headerOpts },
  { text: "전환 역할", options: headerOpts },
  { text: "타겟 세그먼트", options: headerOpts },
];
const pageRows = [
  { n: "1", sec: "히어로 영상", role: "첫 인상 — MANO+로스팅+공간", target: "전체", hl: false },
  { n: "2", sec: "시즌 배너", role: "새 소식, 시즌 메뉴", target: "단골, 디저트팬", hl: false },
  { n: "3", sec: "카페 메뉴 카드", role: "매장 방문 유도 (1차 전환)", target: "단골, 디저트팬, 입문자", hl: true },
  { n: "4", sec: "브랜드 스토리", role: "신뢰 형성", target: "입문자, 선물", hl: false },
  { n: "5", sec: "상품 스크롤", role: "원두 구매 (2차 전환)", target: "홈브루어, 선물", hl: false },
  { n: "6", sec: "서비스 카드", role: "구독 전환 (3차 전환)", target: "홈브루어", hl: false },
  { n: "7", sec: "Come visit us", role: "매장 방문 최종 CTA", target: "전체", hl: true },
  { n: "8", sec: "갤러리", role: "공간 매력", target: "디저트팬, 입문자", hl: false },
  { n: "9", sec: "푸터 (SNS)", role: "인스타 연결", target: "전체", hl: false },
];

const pageTableData = [pageHeader];
pageRows.forEach(r => {
  const opts = r.hl ? hlOpts : cellOpts;
  pageTableData.push([
    { text: r.n, options: { ...opts, align: "center" } },
    { text: r.sec, options: r.hl ? { ...hlOpts, bold: true } : { ...opts, bold: true, color: C.black } },
    { text: r.role, options: opts },
    { text: r.target, options: opts },
  ]);
});

s21.addTable(pageTableData, {
  x: 0.8, y: 1.4, w: 8.4,
  colW: [0.5, 2.0, 3.4, 2.5],
  border: { pt: 0.5, color: C.line },
  rowH: [0.32, 0.32, 0.32, 0.37, 0.32, 0.32, 0.32, 0.37, 0.32, 0.32],
});

// ══════════════════════════════════════════════
// SLIDE 22: Next Steps Divider
// ══════════════════════════════════════════════
let s22 = pres.addSlide();
s22.background = { color: C.black };
s22.addText("NEXT STEPS", {
  x: 0.8, y: 1.4, w: 8.4, h: 0.3,
  fontSize: 11, fontFace: "Inter", color: C.gray, charSpacing: 4, bold: true, margin: 0
});
s22.addText("다음 단계", {
  x: 0.8, y: 1.8, w: 8.4, h: 0.7,
  fontSize: 36, fontFace: "Inter", color: C.bg, bold: true, margin: 0
});

const nextSteps = [
  "포토샵 디자인 작업 — 비주얼 시스템 적용",
  "카페 메뉴 페이지 (킬러 콘텐츠 — 최우선)",
  "풍미 노트 시각화 그래픽 방향 확정",
  "히어로 영상 편집 방향 확정",
  "상품 상세 페이지 (구독 비교 UI 포함)",
];
nextSteps.forEach((step, i) => {
  s22.addText(step, {
    x: 0.8, y: 2.8 + i * 0.42, w: 8.4, h: 0.38,
    fontSize: 14, fontFace: "Inter", color: i === 0 ? C.bg : C.mid, lineSpacingMultiple: 1.8, margin: 0
  });
});

// ══════════════════════════════════════════════
// SLIDE 23: Closing
// ══════════════════════════════════════════════
let s23 = pres.addSlide();
s23.background = { color: C.black };
s23.addText("GOOD THINGS ROASTERS", {
  x: 0.8, y: 1.8, w: 8.4, h: 0.3,
  fontSize: 11, fontFace: "Inter", color: C.gray, charSpacing: 4, margin: 0
});
s23.addText("good things,\ntake time", {
  x: 0.8, y: 2.2, w: 8.4, h: 1.6,
  fontSize: 44, fontFace: "Inter", color: C.bg, bold: true, align: "center", lineSpacingMultiple: 1.1, margin: 0
});
s23.addText("Research & Design Direction v1 — 2026.04.05", {
  x: 0.8, y: 4.4, w: 8.4, h: 0.3,
  fontSize: 10, fontFace: "Inter", color: C.stone, align: "center", charSpacing: 2, margin: 0
});

// ── Generate ──
pres.writeFile({ fileName: "C:/Git/goodthings-roasters/docs/gtr-research-presentation.pptx" })
  .then(() => console.log("DONE: gtr-research-presentation.pptx"))
  .catch(err => console.error("ERROR:", err));
