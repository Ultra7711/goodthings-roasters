import ShopPage from '@/components/shop/ShopPage';
import type { FilterKey } from '@/lib/products';

export const metadata = { title: '모든 상품 — good things' };

const VALID_FILTERS: FilterKey[] = ['all', 'bean', 'drip', 'sub'];

export default async function ShopRoute({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const initial: FilterKey =
    filter && (VALID_FILTERS as string[]).includes(filter) ? (filter as FilterKey) : 'all';
  return <ShopPage initialFilter={initial} />;
}
