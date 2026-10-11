/**
 * Единая точка подключения к Supabase.
 *
 * Ключи берутся из переменных окружения Vite (файл `.env.local` в корне,
 * он НЕ попадает в git — см. .gitignore):
 *   VITE_SUPABASE_URL      — Project URL  (Settings → API)
 *   VITE_SUPABASE_ANON_KEY — public "anon" key (Settings → API)
 *
 * Если переменные не заданы — приложение продолжает работать на локальном
 * хранилище (localStorage), т.е. миграция на Supabase полностью обратима:
 * достаточно удалить/заполнить .env.local.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,          // сессия переживает перезагрузку страницы
        autoRefreshToken: true,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  // Не критично: просто подсказка разработчику, почему данные локальные.
  console.info(
    '[storage] Supabase не настроен (нет VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — ' +
      'используется локальное хранилище (localStorage).',
  );
}
