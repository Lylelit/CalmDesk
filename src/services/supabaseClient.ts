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

/**
 * Приводит значение из .env к «здоровому» виду: вырезает пробелы/переносы,
 * кавычки и завершающий слэш. Частая причина падения приложения — URL,
 * скопированный с лишним символом или с пустыми строками в .env.local.
 */
function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '') // кавычки по краям
    .replace(/\/+$/, '');          // завершающий слэш недопустим
}

/** Проверка, что это действительно http(s)-URL — иначе Supabase падает с «Invalid supabaseUrl». */
function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value);
}

/**
 * Поддерживаем оба набора имён переменных:
 *   VITE_*                  — стандартный префикс Vite (рекомендуется);
 *   NEXT_PUBLIC_*           — префикс Next.js; если .env.local был заполнен
 *                             по чужой инструкции с этим префиксом, значения
 *                             всё равно подхватятся (см. vite.config.ts -> envPrefix).
 */
const env = import.meta.env as Record<string, string | undefined>;

const rawUrl = normalize(env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL);
const rawKey = normalize(
  env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const urlValid = looksLikeHttpUrl(rawUrl);
const keyValid = rawKey.length > 0;

// Если значения заданы, но кривые — loudly предупреждаем вместо тихого white screen.
if ((rawUrl || rawKey) && !(urlValid && keyValid)) {
  console.error(
    '[storage] Supabase НЕ подключён: переменные окружения заданы некорректно.\n' +
      `  SUPABASE_URL=${JSON.stringify(rawUrl)} ${urlValid ? '✅' : '❌ должен начинаться с https:// (без кавычек, пробелов и слэша на конце)'}\n` +
      `  SUPABASE_KEY=${rawKey ? 'задан ✅' : 'пуст ❌'}`,
  );
}

export const isSupabaseConfigured = urlValid && keyValid;

// Защита от «белого экрана»: если ключи отсутствуют/битые (например, GitHub Pages
// собран без секретов), не роняем приложение createClient() — остаёмся на localStorage.
// Битые ключи в LOCAL-сборке считаем ошибкой конфигурации тоже безопасно: приложение
// продолжит жить на localStorage, а точная причина будет в console.error выше.
const shouldCreateClient = isSupabaseConfigured;

export const supabase: SupabaseClient | null = shouldCreateClient
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,          // сессия переживает перезагрузку страницы
        autoRefreshToken: true,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  // Не критично: просто подсказка разработчику, почему данные локальные.
  console.info(
    '[storage] Supabase не настроен (нет корректных VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — ' +
      'используется локальное хранилище (localStorage).',
  );
}
