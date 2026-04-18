-- ═══════════════════════════════════════════════════════════════════════════
-- verify_p0.sql — P0 마이그레이션 적용 후 검증 쿼리
-- 각 섹션이 기대 행수를 반환해야 통과.
-- ═══════════════════════════════════════════════════════════════════════════

-- §1 테이블 7종 존재 확인 (기대: 7행)
select 'tables' as check, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles', 'addresses', 'orders', 'order_items',
    'subscriptions', 'payment_transactions'
  )
order by table_name;

-- §2 ENUM 타입 5종 (기대: 5행)
select 'enums' as check, t.typname
from pg_type t
join pg_namespace n on t.typnamespace = n.oid
where n.nspname = 'public'
  and t.typtype = 'e'
  and t.typname in (
    'order_status', 'order_item_type', 'subscription_period',
    'subscription_status', 'payment_event_type'
  )
order by t.typname;

-- §3 RLS 활성화 확인 — 6개 테이블 모두 relrowsecurity=true + relforcerowsecurity=true (기대: 6행)
select 'rls_enabled' as check, c.relname,
       c.relrowsecurity as rls_on,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'public'
  and c.relname in ('profiles','addresses','orders','order_items','subscriptions','payment_transactions')
order by c.relname;

-- §4 정책 카운트 (기대: 최소 10개 — profiles 2 + addresses 4 + orders 2 + order_items 1 + subscriptions 2)
select 'policy_count' as check, tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- §5 함수 존재 (기대: 5행 — set_updated_at, prevent_id_change, prevent_profiles_email_change, sync_profiles_email, handle_new_user, set_order_number)
select 'functions' as check, p.proname
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at', 'prevent_id_change', 'prevent_profiles_email_change',
    'sync_profiles_email', 'handle_new_user', 'set_order_number'
  )
order by p.proname;

-- §6 트리거 존재 확인 — auth.users + 각 public 테이블 (기대: 10+행)
select 'triggers' as check, event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where event_object_schema in ('public', 'auth')
  and trigger_name in (
    'on_auth_user_created',
    'on_auth_user_email_updated',
    'profiles_prevent_id_change',
    'profiles_prevent_email_change',
    'profiles_set_updated_at',
    'addresses_prevent_id_change',
    'addresses_set_updated_at',
    'orders_set_order_number',
    'orders_prevent_id_change',
    'orders_set_updated_at',
    'subscriptions_prevent_id_change',
    'subscriptions_set_updated_at'
  )
order by event_object_schema, event_object_table, trigger_name;

-- §7 시퀀스 존재 (기대: 1행 — order_number_seq)
select 'sequence' as check, sequence_name
from information_schema.sequences
where sequence_schema = 'public'
  and sequence_name = 'order_number_seq';

-- §8 UNIQUE 인덱스 확인 (부분 UNIQUE 포함)
select 'indexes' as check, tablename, indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'profiles_email_key',
    'addresses_one_default_per_user',
    'payment_transactions_idempotency_unique'
  )
order by tablename, indexname;

-- §9 프로젝트 테이블 row count (기대: 0 — 모두 비어 있어야 함)
select 'row_count' as check, 'profiles' as tbl, count(*)::int from public.profiles
union all
select 'row_count', 'addresses', count(*)::int from public.addresses
union all
select 'row_count', 'orders', count(*)::int from public.orders
union all
select 'row_count', 'order_items', count(*)::int from public.order_items
union all
select 'row_count', 'subscriptions', count(*)::int from public.subscriptions
union all
select 'row_count', 'payment_transactions', count(*)::int from public.payment_transactions;

-- §10 handle_new_user 함수 소스 스냅샷 (H2 sanitize 포함 확인)
select 'handle_new_user_src' as check,
       position('regexp_replace' in pg_get_functiondef(p.oid)) > 0 as has_sanitize,
       position('split_part' in pg_get_functiondef(p.oid)) > 0 as has_fallback
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public' and p.proname = 'handle_new_user';
