import { useCallback, useState } from 'react';
import { Task, TaskAssignment } from '../types';
import { generateId, HOURS_PER_DAY } from '../utils/dateUtils';

export type DayStatus = 'vacation' | 'holiday' | 'short' | 'working';
export interface DayStatusEntry {
  status: Exclude<DayStatus, 'working'>;
  hours?: number;
}

/**
 * Централизованное управление задачами и их назначениями на дни.
 * Все мутации инкапсулированы здесь — компоненты получают только
 * стабильные коллбэки (useCallback), что упрощает тестирование и
 * исключает дублирование логики в App.
 */
export function useTaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setAssignments((prev) => prev.filter((a) => a.taskId !== taskId));
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() } : t,
      ),
    );
  }, []);

  /** Возврат выполненной задачи в «новые» с дополнительными часами на доработку. */
  const returnToNew = useCallback(
    (taskId: string, additionalHours: number) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const alreadyAssigned = assignments
            .filter((a) => a.taskId === taskId)
            .reduce((sum, a) => sum + a.hours, 0);
          return {
            ...t,
            status: 'new' as const,
            completedAt: undefined,
            totalHours: alreadyAssigned + additionalHours,
          };
        }),
      );
    },
    [assignments],
  );

  const editTask = useCallback((updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  }, []);

  /** Перемешивание карточек задач в списке сайдбара (drag & drop). */
  const reorderTask = useCallback((draggedId: string, targetId: string) => {
    setTasks((prev) => {
      const newTasks = [...prev];
      const draggedIndex = newTasks.findIndex((t) => t.id === draggedId);
      const targetIndex = newTasks.findIndex((t) => t.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [draggedTask] = newTasks.splice(draggedIndex, 1);
      newTasks.splice(targetIndex, 0, draggedTask);
      return newTasks;
    });
  }, []);

  /** Разделение блока назначения на две части. */
  const splitAssignment = useCallback(
    (assignmentId: string, hoursToSplit: number) => {
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment || hoursToSplit <= 0 || hoursToSplit >= assignment.hours) return;
      const rest = assignment.hours - hoursToSplit;
      setAssignments((prev) => [
        ...prev.filter((a) => a.id !== assignmentId),
        { ...assignment, hours: hoursToSplit },
        { ...assignment, id: generateId(), hours: rest, order: assignment.order + 0.5 },
      ]);
    },
    [assignments],
  );

  const removeAssignment = useCallback((assignmentId: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }, []);

  const moveAssignment = useCallback((assignmentId: string, newDayId: string) => {
    setAssignments((prev) => {
      const assignment = prev.find((a) => a.id === assignmentId);
      if (!assignment) return prev;
      const maxOrder = prev
        .filter((a) => a.dayId === newDayId)
        .reduce((max, a) => Math.max(max, a.order), 0);
      return prev.map((a) => (a.id === assignmentId ? { ...a, dayId: newDayId, order: maxOrder + 1 } : a));
    });
  }, []);

  /** Обмен порядком двух блоков внутри одного дня. */
  const reorderAssignment = useCallback((sourceId: string, targetId: string) => {
    setAssignments((prev) => {
      const source = prev.find((a) => a.id === sourceId);
      const target = prev.find((a) => a.id === targetId);
      if (!source || !target) return prev;
      return prev.map((a) => {
        if (a.id === sourceId) return { ...a, order: target.order };
        if (a.id === targetId) return { ...a, order: source.order };
        return a;
      });
    });
  }, []);

  /** Слияние двух блоков одной задачи в одном дне. */
  const mergeAssignments = useCallback((sourceId: string, targetId: string) => {
    setAssignments((prev) => {
      const source = prev.find((a) => a.id === sourceId);
      const target = prev.find((a) => a.id === targetId);
      if (!source || !target || source.taskId !== target.taskId) return prev;
      const newHours = source.hours + target.hours;
      return prev
        .filter((a) => a.id !== sourceId)
        .map((a) => (a.id === targetId ? { ...a, hours: newHours } : a));
    });
  }, []);

  /** Назначение задачи на день: новый блок или увеличение существующего. */
  const dropTask = useCallback(
    (taskId: string, dayId: string, hours: number) => {
      const existing = assignments.find((a) => a.taskId === taskId && a.dayId === dayId);
      const dayTotal = assignments
        .filter((a) => a.dayId === dayId)
        .reduce((sum, a) => sum + a.hours, 0);
      if (dayTotal + hours > HOURS_PER_DAY) return;
      if (existing) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === existing.id ? { ...a, hours: a.hours + hours } : a)),
        );
        return;
      }
      const maxOrder = assignments
        .filter((a) => a.dayId === dayId)
        .reduce((max, a) => Math.max(max, a.order), 0);
      setAssignments((prev) => [
        ...prev,
        { id: generateId(), taskId, dayId, hours, order: maxOrder + 1 },
      ]);
    },
    [assignments],
  );

  const getTaskAssignedHours = useCallback(
    (taskId: string) =>
      assignments.filter((a) => a.taskId === taskId).reduce((sum, a) => sum + a.hours, 0),
    [assignments],
  );

  const resetBoard = useCallback(() => {
    setTasks([]);
    setAssignments([]);
  }, []);

  return {
    tasks,
    setTasks,
    assignments,
    setAssignments,
    addTask,
    deleteTask,
    completeTask,
    returnToNew,
    editTask,
    reorderTask,
    splitAssignment,
    removeAssignment,
    moveAssignment,
    reorderAssignment,
    mergeAssignments,
    dropTask,
    getTaskAssignedHours,
    resetBoard,
  };
}
