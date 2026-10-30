-- At most one active API key per email. Free signups store the
-- lowercased email in owner_label. Not applied automatically — run
-- this once in the Supabase SQL editor. Safe to run more than once.
create unique index if not exists api_keys_one_active_email_idx
  on api_keys (owner_label)
  where is_active = true
    and owner_label is not null
    and position('@' in owner_label) > 0;
