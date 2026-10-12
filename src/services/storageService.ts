import { Task, TaskAssignment } from '../types';
import { Profile } from '../components/AuthScreen';
import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Слой хранилища с двумя режимами:
 *   - 'supabase' — данные в облаке (если заданы VITE_SUPABASE_URL/ANON_KEY);
 *   - 'local'    — localStorage (прежнее поведение, работает без настройки).
 *
 * Все функции асинхронные и одинаково работают в обоих режимах, поэтому
 * «переезд» на Supabase не требует правок UI: достаточно применить
 * `supabase/schema.sql` и создать `.env.local` с ключами проекта.
 */

let currentProfile: Profile | null = null;
// uuid пользователя Supabase (auth.uid()) — заполняется AuthContext'ом после входа.
// Нужен как owner_id для облачных таблиц; в локальном режиме не используется.
let currentUserId: string | null = null;

export function setCurrentProfile(profile: Profile | null) {
  currentProfile = profile;
  if (!profile) currentUserId = null;
}

export function setSupabaseUserId(userId: string | null) {
  currentUserId = userId;
}

export function getSupabaseUserId(): string | null {
  return currentUserId;
}

export function getCurrentProfile(): Profile | null {
  return currentProfile;
}

export function getStorageMode(): 'supabase' | 'local' {
  return isSupabaseConfigured && supabase ? 'supabase' : 'local';
}

// ── Конвертеры форм: БД-строка ↔ тип приложения ─────────────────────────────
interface TaskRow {
  id: string; title: string; total_hours: number; color: string;
  description: string | null; link: string | null;
  status: 'new' | 'completed' | null; created_at: string | null; completed_at: string | null;
}
interface AssignmentRow {
  id: string; task_id: string; day_id: string; hours: number; order: number;
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  totalHours: Number(r.total_hours),
  color: r.color,
  description: r.description ?? undefined,
  link: r.link ?? undefined,
  status: r.status ?? 'new',
  createdAt: r.created_at ?? undefined,
  completedAt: r.completed_at ?? undefined,
});

const toAssignment = (r: AssignmentRow): TaskAssignment => ({
  id: r.id,
  taskId: r.task_id,
  dayId: r.day_id,
  hours: Number(r.hours),
  order: r.order,
});

// ── Публичный API ────────────────────────────────────────────────────────────
export async function loadTasks(viewer?: { userId?: string }): Promise<Task[]> {
  if (getStorageMode() === 'supabase') {
    // viewer.userId — режим руководителя: смотрим доску сотрудника.
    // Без него RLS и так вернёт только строки владельца (owner_id = auth.uid()).
    let query = supabase!.from('tasks').select('*');
    if (viewer?.userId) query = query.eq('owner_id', viewer.userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as TaskRow[]).map(toTask);
  }
  if (!currentProfile) return [];
  const data = getProfileData(currentProfile.login);
  return data.tasks || [];
}

export async function loadAssignments(viewer?: { userId?: string }): Promise<TaskAssignment[]> {
  if (getStorageMode() === 'supabase') {
    let query = supabase!.from('assignments').select('*');
    if (viewer?.userId) query = query.eq('owner_id', viewer.userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as AssignmentRow[]).map(toAssignment);
  }
  if (!currentProfile) return [];
  const data = getProfileData(currentProfile.login);
  return data.assignments || [];
}

/**
 * Полная синхронизация списка задач (diff-based upsert).
 * В supabase-режиме localStorage тоже обновляется зеркально — это наш
 * «страховочный копия» и источник для миграции старых данных.
 */
export async function saveTasks(tasks: Task[], ownerId?: string): Promise<void> {
  if (currentProfile) {
    const data = getProfileData(currentProfile.login);
    saveProfileData(currentProfile.login, { ...data, tasks });
  }
  if (getStorageMode() !== 'supabase' || !supabase) return;
  const owner = ownerId ?? currentUserId ?? currentProfile?.id;
  if (!owner) return;

  const { data: existing, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('owner_id', owner);
  if (error) throw error;

  const incomingIds = new Set(tasks.map((t) => t.id));
  const toDelete = (existing as { id: string }[]).map((e) => e.id).filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('tasks').delete().in('id', toDelete).eq('owner_id', owner);
    if (delErr) throw delErr;
  }

  if (tasks.length > 0) {
    const rows = tasks.map((t) => ({
      id: t.id,
      owner_id: owner,
      title: t.title,
      total_hours: t.totalHours,
      color: t.color,
      description: t.description ?? null,
      link: t.link ?? null,
      status: t.status ?? 'new',
      created_at: t.createdAt ?? null,
      completed_at: t.completedAt ?? null,
    }));
    const { error: upErr } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
    if (upErr) throw upErr;
  }
}

export async function saveAssignments(assignments: TaskAssignment[], ownerId?: string): Promise<void> {
  if (currentProfile) {
    const data = getProfileData(currentProfile.login);
    saveProfileData(currentProfile.login, { ...data, assignments });
  }
  if (getStorageMode() !== 'supabase' || !supabase) return;
  const owner = ownerId ?? currentUserId ?? currentProfile?.id;
  if (!owner) return;

  const { data: existing, error } = await supabase
    .from('assignments')
    .select('id')
    .eq('owner_id', owner);
  if (error) throw error;

  const incomingIds = new Set(assignments.map((a) => a.id));
  const toDelete = (existing as { id: string }[]).map((e) => e.id).filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('assignments').delete().in('id', toDelete).eq('owner_id', owner);
    if (delErr) throw delErr;
  }

  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      id: a.id,
      owner_id: owner,
      task_id: a.taskId,
      day_id: a.dayId,
      hours: a.hours,
      order: a.order,
    }));
    const { error: upErr } = await supabase.from('assignments').upsert(rows, { onConflict: 'id' });
    if (upErr) throw upErr;
  }
}

/**
 * Однократный перенос локальных данных пользователя в Supabase.
 * Вызывается при первом входе после настройки облачного режима.
 */
export async function migrateLocalToSupabase(userId: string): Promise<{ migrated: boolean; tasks: number; assignments: number }> {
  if (getStorageMode() !== 'supabase' || !currentProfile || !supabase) return { migrated: false, tasks: 0, assignments: 0 };
  const sb = supabase;

  const local = getProfileData(currentProfile.login);
  // Если в облаке уже есть данные пользователя — не трогаем (защита от двойной миграции).
  const { count } = await sb
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if ((count ?? 0) > 0) return { migrated: false, tasks: 0, assignments: 0 };

  if (local.tasks.length > 0) {
    await sb.from('tasks').insert(local.tasks.map((t) => ({
      id: t.id, owner_id: userId, title: t.title, total_hours: t.totalHours, color: t.color,
      description: t.description ?? null, link: t.link ?? null, status: t.status ?? 'new',
      created_at: t.createdAt ?? null, completed_at: t.completedAt ?? null,
    })));
  }
  if (local.assignments.length > 0) {
    await sb.from('assignments').insert(local.assignments.map((a) => ({
      id: a.id, owner_id: userId, task_id: a.taskId, day_id: a.dayId, hours: a.hours, order: a.order,
    })));
  }
  return { migrated: true, tasks: local.tasks.length, assignments: local.assignments.length };
}

// ── Статусы дней (отпуск / выходной / короткий день) ────────────────────────
// Ключ дня — текст ('YYYY-MM-DD'), значение — статус и опциональные часы
// для короткого дня. Хранятся в таблице day_statuses под тем же owner_id,
// что и задачи, поэтому RLS-политики для них идентичны задачам.
export interface DayStatusRecord {
  status: 'vacation' | 'holiday' | 'short';
  hours?: number;
}
export type DayStatusMap = Record<string, DayStatusRecord>;

interface DayStatusRow {
  day_id: string;
  status: 'vacation' | 'holiday' | 'short';
  short_hours: number | null;
}

/**
 * Загрузка статусов дней владельца доски.
 * Ошибку пробрасываем наружу — вызывающий код покажет её в консоли,
 * но ронять загрузку доски из-за этого не нужно (см. App.loadData).
 */
export async function loadDayStatuses(viewer?: { userId?: string }): Promise<DayStatusMap> {
  if (getStorageMode() === 'supabase' && supabase) {
    const owner = viewer?.userId ?? currentUserId ?? currentProfile?.id;
    if (!owner) return {};
    const { data, error } = await supabase.from('day_statuses').select('*').eq('owner_id', owner);
    if (error) throw error;
    const map: DayStatusMap = {};
    for (const r of data as DayStatusRow[]) {
      map[r.day_id] = r.status === 'short' ? { status: 'short', hours: Number(r.short_hours ?? 0) } : { status: r.status };
    }
    return map;
  }
  // Локальный режим: ключ по логину профиля (совпадает с App).
  if (!currentProfile) return {};
  try {
    const saved = localStorage.getItem(`planner-day-statuses-${currentProfile.login}`);
    return saved ? (JSON.parse(saved) as DayStatusMap) : {};
  } catch {
    return {};
  }
}

/**
 * Полная синхронизация статусов дней (diff: удаляем ушедшие, upsert остальных).
 * В локальном режиме зеркально пишем в localStorage под тем же ключом,
 * который использует App.
 */
export async function saveDayStatuses(statuses: DayStatusMap, ownerId?: string): Promise<void> {
  if (currentProfile) {
    localStorage.setItem(`planner-day-statuses-${currentProfile.login}`, JSON.stringify(statuses));
  }
  if (getStorageMode() !== 'supabase' || !supabase) return;
  const owner = ownerId ?? currentUserId ?? currentProfile?.id;
  if (!owner) return;

  const ids = Object.keys(statuses);
  const { data: existing, error } = await supabase
    .from('day_statuses')
    .select('day_id')
    .eq('owner_id', owner);
  if (error) throw error;

  const incoming = new Set(ids);
  const toDelete = (existing as { day_id: string }[]).map((e) => e.day_id).filter((d) => !incoming.has(d));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('day_statuses')
      .delete()
      .in('day_id', toDelete)
      .eq('owner_id', owner);
    if (delErr) throw delErr;
  }

  if (ids.length > 0) {
    const rows = ids.map((dayId) => ({
      owner_id: owner,
      day_id: dayId,
      status: statuses[dayId].status,
      short_hours: statuses[dayId].status === 'short' ? (statuses[dayId].hours ?? null) : null,
    }));
    const { error: upErr } = await supabase
      .from('day_statuses')
      .upsert(rows, { onConflict: 'owner_id,day_id' });
    if (upErr) throw upErr;
  }
}

interface ProfileData {
  tasks: Task[];
  assignments: TaskAssignment[];
}

const DATA_KEY = 'planner-data-';

export function getProfileData(login: string): ProfileData {
  try {
    const saved = localStorage.getItem(DATA_KEY + login);
    return saved ? JSON.parse(saved) : { tasks: [], assignments: [] };
  } catch {
    return { tasks: [], assignments: [] };
  }
}

export function saveProfileData(login: string, data: ProfileData) {
  localStorage.setItem(DATA_KEY + login, JSON.stringify(data));
}
