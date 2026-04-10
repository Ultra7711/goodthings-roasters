/* ══════════════════════════════════════════
   Navigation & Layout Types
   ══════════════════════════════════════════ */

export type NavItem = {
  key: string;
  label: string;
  href: string;
};

export type FooterColumn = {
  title: string;
  links: FooterLink[];
};

export type FooterLink = {
  label: string;
  href: string;
};

export type HeaderTheme = 'light' | 'dark';
