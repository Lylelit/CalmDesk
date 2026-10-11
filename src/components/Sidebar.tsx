import { useTheme } from '../ThemeContext';

interface CollapsedIconButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  badge?: number;
  badgeColor?: string;
}

/** Круглая иконка-кнопка свёрнутого сайдбара с необязательным счётчиком-бейджем. */
function CollapsedIconButton({ onClick, title, children, badge, badgeColor }: CollapsedIconButtonProps) {
  const { theme } = useTheme();
  const color = badgeColor ?? theme.accent1;
  return (
    <button
      onClick={onClick}
      style={{
        background: theme.bgCard,
        borderRadius: 12,
        border: `1px solid ${theme.borderPrimary}`,
        padding: 12,
        boxShadow: theme.shadow,
        position: badge !== undefined ? 'relative' : undefined,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.bgHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = theme.bgCard; }}
      title={title}
    >
      {children}
      {badge !== undefined && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: color,
            color: '#fff',
            borderRadius: '50%',
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

interface SidebarCollapsedProps {
  newTaskCount: number;
  completedTaskCount: number;
  onExpand: () => void;
}

/**
 * Свёрнутое состояние сайдбара — только иконки.
 * Каждая иконка разворачивает панель (форма/поиск остаются свёрнутыми,
 * как и другие разделы).
 */
export default function SidebarCollapsed({ newTaskCount, completedTaskCount, onExpand }: SidebarCollapsedProps) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      {/* Кнопка разворачивания */}
      <CollapsedIconButton onClick={onExpand} title="Развернуть панель">
        <svg width="20" height="20" fill="none" stroke={theme.accent1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </CollapsedIconButton>

      {/* Иконка "Мои задачи" — разворачивает панель (форма остаётся свёрнутой) */}
      <CollapsedIconButton onClick={onExpand} title="Мои задачи (развернуть панель и создать задачу)">
        <svg width="20" height="20" fill="none" stroke={theme.accent1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </CollapsedIconButton>

      {/* Иконка поиска — разворачивает панель */}
      <CollapsedIconButton onClick={onExpand} title="Поиск и фильтры (развернуть панель)">
        <svg width="20" height="20" fill="none" stroke={theme.accent1} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      </CollapsedIconButton>

      {/* Иконка "Новые задачи" — разворачивает панель к списку новых задач */}
      {newTaskCount > 0 && (
        <CollapsedIconButton
          onClick={onExpand}
          title={`Новые задачи: ${newTaskCount} (развернуть панель)`}
          badge={newTaskCount}
        >
          <svg width="20" height="20" fill="none" stroke={theme.accent1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </CollapsedIconButton>
      )}

      {/* Иконка "Выполненные задачи" — разворачивает панель; счётчик всегда по всем выполненным */}
      {completedTaskCount > 0 && (
        <CollapsedIconButton
          onClick={onExpand}
          title={`Выполненные задачи: ${completedTaskCount} (развернуть панель)`}
          badge={completedTaskCount}
          badgeColor={theme.success}
        >
          <svg width="20" height="20" fill="none" stroke={theme.success} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </CollapsedIconButton>
      )}
    </div>
  );
}

interface HintBannerProps {
  onDismiss: () => void;
}

const HINT_ITEMS = [
  ['Создайте задачу', 'слева с оценкой в часах'],
  ['Перетащите', 'задачу на любой день — появится выбор часов'],
  ['Перетаскивайте блоки', 'между днями для перераспределения'],
  ['Разбивайте', 'задачу на части или убирайте из дня'],
];

/** Баннер «Как пользоваться» над лентой недель. */
export function HintBanner({ onDismiss }: HintBannerProps) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        marginBottom: 16,
        background: `${theme.accent1}10`,
        borderRadius: 16,
        border: `1px solid ${theme.accent1}30`,
        padding: 16,
        position: 'relative',
      }}
    >
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: 4,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: 'transparent',
          color: theme.textTertiary,
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h4 style={{ fontSize: 14, fontWeight: 600, color: theme.accent1, marginBottom: 8 }}>💡 Как пользоваться</h4>
      <ul style={{ fontSize: 12, color: theme.textSecondary, listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {HINT_ITEMS.map(([bold, rest]) => (
          <li key={bold}>• <b>{bold}</b> {rest}</li>
        ))}
        <li>• Каждый день = 8 рабочих часов</li>
      </ul>
    </div>
  );
}


