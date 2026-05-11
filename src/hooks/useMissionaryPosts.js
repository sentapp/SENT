import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  createMissionaryPost,
  deleteMissionaryPost,
  fetchMissionaryPosts,
  updateMissionaryPost,
} from '../lib/postsRepository';

export function useMissionaryPosts(missionaryId) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!missionaryId || !supabase) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchMissionaryPosts(supabase, missionaryId);
    setPosts(list);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addPost = useCallback(
    async ({ typeUi, locationName, body }) => {
      if (!supabase || !missionaryId) return { ok: false, error: 'Not signed in.' };
      const res = await createMissionaryPost(supabase, missionaryId, { typeUi, locationName, body });
      if (res.error) return { ok: false, error: res.error.message || String(res.error) };
      await refetch();
      return {
        ok: true,
        data: res.data,
        locationWarning: Boolean(res.locationWarning),
      };
    },
    [missionaryId, refetch],
  );

  const updatePost = useCallback(
    async (postId, fields, existingPost) => {
      if (!supabase || !missionaryId) return { ok: false, error: 'Not signed in.' };
      const res = await updateMissionaryPost(supabase, missionaryId, postId, fields, existingPost);
      if (res.error) return { ok: false, error: res.error.message || String(res.error) };
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)));
      return {
        ok: true,
        data: res.data,
        locationWarning: Boolean(res.locationWarning),
      };
    },
    [missionaryId],
  );

  const deletePost = useCallback(async (postId) => {
    if (!supabase || !missionaryId) return { ok: false, error: 'Not signed in.' };
    const { error } = await deleteMissionaryPost(supabase, missionaryId, postId);
    if (error) return { ok: false, error: error.message || String(error) };
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    return { ok: true };
  }, [missionaryId]);

  return { posts, loading, refetch, addPost, updatePost, deletePost };
}
