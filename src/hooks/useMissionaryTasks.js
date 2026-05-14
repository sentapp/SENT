import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { completeTask, fetchTasksForMissionary, uncompleteTask } from '../lib/tasksRepository';

export function useMissionaryTasks(missionaryId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchTasksForMissionary(supabase, missionaryId);
    setTasks(list);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const patchTask = useCallback((id, partial) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)));
  }, []);

  const toggleTaskComplete = useCallback(
    async (task) => {
      if (!supabase || !missionaryId || !task?.id) return;
      if (!task.isComplete) {
        patchTask(task.id, { isComplete: true, completedAt: new Date().toISOString() });
        await completeTask(supabase, task.id, missionaryId);
      } else {
        patchTask(task.id, { isComplete: false, completedAt: null });
        await uncompleteTask(supabase, task.id, missionaryId);
      }
      await refetch();
    },
    [missionaryId, patchTask, refetch],
  );

  return { tasks, loading, refetch, patchTask, toggleTaskComplete };
}
