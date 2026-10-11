import { useTheme } from '../ThemeContext';

/** Центральная палитра цветов задач — единый источник для формы, редактирования и экспорта. */
export const TASK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

/** Быстрые пресеты времени (в часах) с порогом 15 минут. */
export const QUICK_HOUR_PRESETS = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4];

interface SpinnerProps {
  size?: number;
  label?: string;
}

/** Универсальный спиннер загрузки (используется на этапах авторизации и загрузки данных). */
export function Spinner({ size = 48, label = 'Загрузка...' }: SpinnerProps) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.bgPrimary,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: size,
            height: size,
            border: `4px solid ${theme.borderPrimary}`,
            borderTopColor: theme.accent1,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: theme.textSecondary, fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

interface IconButtonProps {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  size?: number;
  bordered?: boolean;
}

/** Небольшая квадратная кнопка-иконка в стиле шапки приложения. */
export function IconButton({ onClick, title, children, size = 16, bordered = true }: IconButtonProps) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 8,
        borderRadius: 8,
        border: bordered ? `1px solid ${theme.borderPrimary}` : 'none',
        background: bordered ? theme.bgSecondary : 'transparent',
        color: theme.textSecondary,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

/** Затемнённый оверлей модального окна: клик по фону закрывает окно, клик по содержимому — нет. */
export function ModalOverlay({ onClose, children, maxWidth = 500 }: ModalOverlayProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div style={{ maxWidth, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
