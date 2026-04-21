export const TOP_DEFAULT = '#F5F3F0';
export const BOTTOM_COLOR = '#4A4845';

let topColor = TOP_DEFAULT;

export const getTopColor = () => topColor;
export const setTopColor = (c: string) => { topColor = c; };
export const resetTopColor = () => { topColor = TOP_DEFAULT; };
