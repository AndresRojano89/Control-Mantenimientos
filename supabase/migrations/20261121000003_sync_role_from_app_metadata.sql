-- GoTrue guarda app_metadata personalizado DESPUÉS de insertar el usuario.
-- Sincroniza el rol del perfil cuando cambia app_metadata.role (solo la service role puede cambiarlo).
create or replace function public.sync_profile_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role')
     and (new.raw_app_meta_data ->> 'role') in ('admin', 'supervisor') then
    update public.profiles set role = (new.raw_app_meta_data ->> 'role')::public.app_role where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role();
