update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','image/gif']
 where id = 'product-images';

drop policy if exists "Store members upload product images" on storage.objects;
drop policy if exists "Store members update product images" on storage.objects;
drop policy if exists "Store members delete product images" on storage.objects;

create policy "Store managers upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_manage_store_folder((storage.foldername(name))[1]));

create policy "Store managers update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.can_manage_store_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'product-images' and private.can_manage_store_folder((storage.foldername(name))[1]));

create policy "Store managers delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.can_manage_store_folder((storage.foldername(name))[1]));

create policy "Store managers read product images" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and private.can_manage_store_folder((storage.foldername(name))[1]));
