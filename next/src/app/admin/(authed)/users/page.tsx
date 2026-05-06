/* ══════════════════════════════════════════════════════════════════════════
   AdminUsersPage (서버 컴포넌트) — S169 PR-1 Group C-1

   - searchParams 로 q · role · page 수신
   - fetchAdminUsers 가 RLS 통한 admin SELECT (profiles_select_admin 020)
   - 인터랙션은 UsersTableClient (client) 가 담당
   ══════════════════════════════════════════════════════════════════════════ */

import { fetchAdminUsers } from '@/lib/admin/usersServer';
import UsersTableClient from './UsersTableClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const result = await fetchAdminUsers(raw);
  return (
    <UsersTableClient
      rows={result.rows}
      total={result.total}
      counts={result.counts}
      filters={result.filters}
    />
  );
}
