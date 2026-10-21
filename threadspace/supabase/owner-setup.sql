-- Run ONCE in the Supabase SQL editor after you have created your own owner account
-- (Authentication > Users > Add user, with Auto Confirm User ticked).
-- Owners can only be added this way: no browser request can create one.
insert into public.platform_owners (user_id)
select id from auth.users
where lower(email) = lower('YOUR-OWNER-EMAIL@example.com') and email_confirmed_at is not null
on conflict (user_id) do nothing;
