-- Bot key scope 'voice' — iPhone Share-Sheet Shortcut "ส่งเข้า amgo" (owner 19 Nov 2026).
-- Acts as acts_as (the owner) and only works on /api/bot/voice/* (enforced in lib/services/bot/botApi.ts).
alter table public.bot_api_keys drop constraint if exists bot_api_keys_scope_check;
alter table public.bot_api_keys add constraint bot_api_keys_scope_check
  check (scope in ('superadmin', 'general', 'dev', 'voice'));
