/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} postIds
 * @returns {Promise<Map<string, Array<{ id: string, body: string, createdAt: string, authorId: string, authorDisplayName: string }>>>}
 */
export async function fetchCommentsForPosts(supabaseClient, postIds) {
  const map = new Map();
  if (!supabaseClient || !postIds?.length) return map;
  const unique = [...new Set(postIds.filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await supabaseClient
    .from('post_comments')
    .select('id, post_id, author_id, body, author_display_name, created_at')
    .in('post_id', unique)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchCommentsForPosts', error);
    return map;
  }

  for (const row of data || []) {
    const pid = row.post_id;
    const list = map.get(pid) || [];
    list.push({
      id: row.id,
      postId: pid,
      authorId: row.author_id,
      body: row.body || '',
      authorDisplayName: row.author_display_name || 'Anonymous',
      createdAt: row.created_at,
    });
    map.set(pid, list);
  }
  return map;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{ postId: string, authorId: string, body: string }} row
 */
export async function insertPostComment(supabaseClient, { postId, authorId, body }) {
  const text = String(body ?? '').trim();
  if (!supabaseClient || !postId || !authorId || !text) {
    return { error: new Error('Invalid comment.') };
  }
  const { data, error } = await supabaseClient
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, body: text })
    .select('id, post_id, author_id, body, author_display_name, created_at')
    .single();

  if (error) return { error };
  return {
    data: {
      id: data.id,
      postId: data.post_id,
      authorId: data.author_id,
      body: data.body || '',
      authorDisplayName: data.author_display_name || 'Anonymous',
      createdAt: data.created_at,
    },
  };
}

export async function updateOwnPostComment(supabaseClient, commentId, authorId, body) {
  const text = String(body ?? '').trim();
  if (!supabaseClient || !commentId || !authorId || !text) {
    return { error: new Error('Invalid comment.') };
  }
  const { data, error } = await supabaseClient
    .from('post_comments')
    .update({ body: text })
    .eq('id', commentId)
    .eq('author_id', authorId)
    .select('id, post_id, author_id, body, author_display_name, created_at')
    .single();

  if (error) return { error };
  return {
    data: {
      id: data.id,
      postId: data.post_id,
      authorId: data.author_id,
      body: data.body || '',
      authorDisplayName: data.author_display_name || 'Anonymous',
      createdAt: data.created_at,
    },
  };
}

export async function deleteOwnPostComment(supabaseClient, commentId, authorId) {
  if (!supabaseClient || !commentId || !authorId) {
    return { error: new Error('Missing id.') };
  }
  const { error } = await supabaseClient.from('post_comments').delete().eq('id', commentId).eq('author_id', authorId);
  if (error) return { error };
  return { ok: true };
}
