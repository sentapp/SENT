import { supabase } from './supabaseClient';

export async function fetchReactionCountsForPosts(postIds) {
  if (!supabase || !postIds?.length) return new Map();
  const { data, error } = await supabase
    .from('post_reactions')
    .select('post_id, kind')
    .in('post_id', postIds);

  if (error || !data) return new Map();

  const counts = new Map();
  for (const id of postIds) {
    counts.set(id, { heart: 0, pray: 0 });
  }
  for (const row of data) {
    const k = counts.get(row.post_id) || { heart: 0, pray: 0 };
    if (row.kind === 'heart') k.heart += 1;
    if (row.kind === 'pray') k.pray += 1;
    counts.set(row.post_id, k);
  }
  return counts;
}

export async function fetchMyReactionsForPosts(postIds, userId) {
  if (!supabase || !postIds?.length || !userId) return new Map();
  const { data, error } = await supabase
    .from('post_reactions')
    .select('post_id, kind')
    .eq('user_id', userId)
    .in('post_id', postIds);

  if (error || !data) return new Map();
  const mine = new Map();
  for (const row of data) {
    const cur = mine.get(row.post_id) || new Set();
    cur.add(row.kind);
    mine.set(row.post_id, cur);
  }
  return mine;
}

export async function togglePostReaction(postId, userId, kind) {
  if (!supabase || !postId || !userId || !['heart', 'pray'].includes(kind)) {
    return { error: new Error('Invalid reaction.') };
  }

  const { data: existing } = await supabase
    .from('post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('post_reactions').delete().eq('id', existing.id);
    if (error) return { error, active: false };
    return { active: false };
  }

  const { error } = await supabase.from('post_reactions').insert({
    post_id: postId,
    user_id: userId,
    kind,
  });
  if (error) return { error, active: false };
  return { active: true };
}
