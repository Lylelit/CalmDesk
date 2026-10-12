/**
 * Сервис «команды» (объединение аккаунтов руководитель ↔ сотрудник).
 * Работает только в supabase-режиме; в локальном — пустые заглушки,
 * чтобы UI не падал без настроенного бэкенда.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface TeamMember {
  id: string;            // uuid сотрудника
  display_name: string;
  email: string;
}

export const isTeamFeatureEnabled = isSupabaseConfigured && !!supabase;

/** Список сотрудников, привязанных к текущему руководителю. */
export async function fetchMyTeam(): Promise<TeamMember[]> {
  if (!isTeamFeatureEnabled) return [];
  const session = (await supabase!.auth.getSession()).data.session;
  if (!session) return [];
  const { data, error } = await supabase!
    .from('team_memberships')
    .select('employee_id')
    .eq('manager_id', session.user.id);
  if (error) throw error;
  const ids = (data ?? []).map((r: { employee_id: string }) => r.employee_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase!
    .from('profiles')
    .select('id, display_name, email')
    .in('id', ids);
  if (pErr) throw pErr;
  return (profiles ?? []) as TeamMember[];
}

/** Руководитель добавляет сотрудника по email (тот должен быть зарегистрирован). */
export async function addTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  if (!isTeamFeatureEnabled) throw new Error('Supabase не настроен');
  const session = (await supabase!.auth.getSession()).data.session;
  if (!session) throw new Error('Нужно войти в систему');

  const cleanEmail = email.trim().toLowerCase();
  const { data: emp, error } = await supabase!
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (error) throw error;
  if (!emp) {
    // Fallback: в profiles мог остаться устаревший email (пользователь
    // подтвердил/изменил его в Auth). Ищем по auth.users через RPC и
    // синхронизируем profiles, затем повторяем поиск.
    const { error: syncErr } = await supabase!.rpc('sync_all_profiles');
    if (syncErr) console.warn('[team] sync_all_profiles:', syncErr.message);
    const { data: emp2, error: err2 } = await supabase!
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (err2) throw err2;
    if (!emp2) {
      throw new Error(
        'Пользователь с таким email не найден среди профилей приложения. ' +
          'Проверьте опечатку или попросите сотрудника войти на сайт хотя бы один раз — профиль создаётся при первом входе.'
      );
    }
    return retryInsertMembership(emp2 as TeamMember, session.user.id);
  }
  return retryInsertMembership(emp as TeamMember, session.user.id);
}

/** Вставка членства в команду; «уже добавлен» считаем успехом. */
async function retryInsertMembership(emp: TeamMember, managerId: string): Promise<TeamMember | null> {
  const { error: insErr } = await supabase!
    .from('team_memberships')
    .insert({ manager_id: managerId, employee_id: emp.id });
  if (insErr) {
    if (insErr.code === '23505') throw new Error('Этот сотрудник уже в вашей команде');
    throw insErr;
  }
  return emp;
}

/** Убрать сотрудника из команды. */
export async function removeTeamMember(employeeId: string): Promise<void> {
  if (!isTeamFeatureEnabled) return;
  const session = (await supabase!.auth.getSession()).data.session;
  if (!session) return;
  const { error } = await supabase!
    .from('team_memberships')
    .delete()
    .eq('manager_id', session.user.id)
    .eq('employee_id', employeeId);
  if (error) throw error;
}

/** Сменить роль пользователя (доступно только руководителю для своих сотрудников). */
export async function setMemberRole(userId: string, role: 'manager' | 'employee'): Promise<void> {
  if (!isTeamFeatureEnabled) throw new Error('Supabase не настроен');
  const { error } = await supabase!.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}
