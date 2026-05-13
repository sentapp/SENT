import { supabase } from './supabaseClient';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif']);

/** True when the `avatars` bucket is missing or storage returns 404 — bucket must exist and be public in Supabase. */
export function isAvatarStorageUnavailableError(err) {
  if (!err) return false;
  const status = err.statusCode ?? err.status;
  if (status === 404) return true;
  const msg = `${err.message ?? ''} ${err.error ?? ''}`.toLowerCase();
  if (msg.includes('bucket not found')) return true;
  if (msg.includes('not found') && (msg.includes('bucket') || msg.includes('object') || msg.includes('resource'))) return true;
  if (msg.includes('does not exist') && msg.includes('bucket')) return true;
  return false;
}

function extFromFile(file) {
  const fromName = file?.name?.split('.').pop()?.toLowerCase() || '';
  if (ALLOWED_EXT.has(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  const mime = String(file?.type || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  return '';
}

/**
 * Upload avatar to public `avatars` bucket as `{userId}.{ext}`, then save `profiles.photo_url`.
 * The `avatars` bucket must exist and be public in Supabase Storage for uploads to succeed.
 */
export async function uploadAvatar(file, userId) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!userId) throw new Error('Not signed in.');
  if (!file) throw new Error('No file selected.');

  const ext = extFromFile(file);
  if (!ext) throw new Error('Use a JPG, PNG, or GIF image.');

  const fileName = `${userId}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, {
    upsert: true,
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('Could not get public URL for avatar.');

  const { error: dbErr } = await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', userId);
  if (dbErr) throw dbErr;

  return publicUrl;
}
