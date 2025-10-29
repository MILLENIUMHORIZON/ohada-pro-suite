-- Ensure company_id is set automatically on insert for currencies
create or replace function public.set_company_id_default()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.company_id is null then
    new.company_id := get_user_company_id();
  end if;
  return new;
end;
$$;

-- Create BEFORE INSERT trigger on currencies
drop trigger if exists set_company_id_on_currencies_insert on public.currencies;
create trigger set_company_id_on_currencies_insert
before insert on public.currencies
for each row
execute function public.set_company_id_default();