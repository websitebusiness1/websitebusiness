import { IMAGE_BUCKET, supabase } from './supabase';

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Client-side check for a friendly message. The bucket enforces the same limits on the server. */
export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES[file.type]) return 'Use a JPEG, PNG, WebP, AVIF or GIF image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

/** Uploads to {store_uuid}/{prefix}-{random}.{ext}. A fresh name each time so nothing is overwritten. */
export async function uploadStoreImage(storeId: string, file: File, prefix: string): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const path = `${storeId}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

export async function removeImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
