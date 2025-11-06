-- Ensure 'documents' storage bucket exists and policies allow upload and public view
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public;

-- Storage policies for the documents bucket
drop policy if exists "Public read documents" on storage.objects;
drop policy if exists "Authenticated can upload documents" on storage.objects;
drop policy if exists "Admins manage documents" on storage.objects;

create policy "Public read documents"
  on storage.objects for select
  using (bucket_id = 'documents');

create policy "Authenticated can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Admins manage documents"
  on storage.objects for all
  using (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'));