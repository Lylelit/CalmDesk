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

  const { data: emp, error } = await supabase!
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!emp) throw new Error('Пользователь с таким email не найден (пусть сначала зарегистрируется)');

  const { error: insErr } = await supabase!
    .from('team_memberships')
    .insert({ manager_id: session.user.id, employee_id: emp.id });
  if (insErr) {
    if (insErr.code === '23505') throw new Error('Этот сотрудник уже в вашей команде');
    throw insErr;
  }
  return emp as TeamMember;
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
