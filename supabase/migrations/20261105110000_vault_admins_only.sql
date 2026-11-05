-- Vault (owner 5 Nov 2569): every admin has full access, including adding accounts and
-- changing grants. This replaces the separate vault_owners list.
create or replace function public.has_vault_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      or exists (select 1 from public.vault_access a where a.user_id = auth.uid() and a.can_view);
$$;

drop table public.vault_owners;
