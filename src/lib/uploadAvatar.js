import { supabase } from './supabaseClient';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif']);

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
