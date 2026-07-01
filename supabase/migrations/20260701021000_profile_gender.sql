alter table public.profiles
  add column if not exists gender text;

update public.profiles
set gender = null
where gender is not null
  and gender not in (
    'male',
    'female',
    'non_binary',
    'prefer_not_to_say',
    'self_describe'
  );

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (
    gender is null
    or gender in (
      'male',
      'female',
      'non_binary',
      'prefer_not_to_say',
      'self_describe'
    )
  );

comment on column public.profiles.gender is
  'Optional self-reported profile gender for user preferences and consented marketing segmentation.';

grant update (gender) on public.profiles to authenticated;
