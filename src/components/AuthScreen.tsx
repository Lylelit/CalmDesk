import { useState } from 'react';
import { useTheme } from '../ThemeContext';

export interface Profile {
  login: string;
  password: string;
  displayName: string;
  createdAt: string;
}

interface AuthScreenProps {
  onLogin: (profile: Profile) => void;
}

const PROFILES_KEY = 'planner-profiles';

export function getProfiles(): Profile[] {
  try {
    const saved = localStorage.getItem(PROFILES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: Profile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'select' | 'login' | 'register'>('select');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [profiles] = useState<Profile[]>(getProfiles());

  const inputStyle = {
    width: '100%', padding: '12px', background: theme.bgSecondary,
    border: `1px solid ${theme.borderPrimary}`, borderRadius: '8px',
    color: theme.textPrimary, fontSize: '14px', outline: 'none',
    transition: 'border-color 0.2s', boxSizing: 'border-box' as const
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login.trim() || !password.trim() || !displayName.trim()) { setError('Заполните все поля'); return; }
    if (password.length < 3) { setError('Пароль должен быть не менее 3 символов'); return; }
    const existingProfiles = getProfiles();
    if (existingProfiles.find(p => p.login.toLowerCase() === login.toLowerCase())) { setError('Такой логин уже существует'); return; }
    const newProfile: Profile = { login: login.trim(), password, displayName: displayName.trim(), createdAt: new Date().toISOString() };
    saveProfiles([...existingProfiles, newProfile]);
    onLogin(newProfile);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login.trim() || !password.trim()) { setError('Введите логин и пароль'); return; }
    const existingProfiles = getProfiles();
    const profile = existingProfiles.find(p => p.login.toLowerCase() === login.toLowerCase() && p.password === password);
    if (!profile) { setError('Неверный логин или пароль'); return; }
    onLogin(profile);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bgPrimary, padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: theme.bgCard, borderRadius: '16px', padding: '32px', boxShadow: theme.shadow }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', background: theme.accent1, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.textPrimary, margin: '0 0 8px' }}>CalmDesk</h1>
          <p style={{ fontSize: '14px', color: theme.textSecondary, margin: 0 }}>
            {mode === 'select' && profiles.length > 0 ? 'Выберите профиль' : mode === 'login' ? 'Вход в систему' : 'Создание профиля'}
          </p>
        </div>

        {mode === 'select' && (
          <>
            {profiles.length > 0 && (
              <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profiles.map(profile => (
                  <button key={profile.login} onClick={() => onLogin(profile)} style={{
                    padding: '12px 16px', background: theme.bgSecondary, border: `1px solid ${theme.borderPrimary}`,
                    borderRadius: '8px', color: theme.textPrimary, fontSize: '14px', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px'
                  }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: theme.accent1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '14px', flexShrink: 0 }}>
                      {profile.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{profile.displayName}</div>
                      <div style={{ fontSize: '12px', color: theme.textTertiary }}>@{profile.login}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setMode('login')} style={{ flex: 1, padding: '12px', background: theme.bgSecondary, color: theme.textPrimary, border: `1px solid ${theme.borderPrimary}`, borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Войти</button>
              <button onClick={() => setMode('register')} style={{ flex: 1, padding: '12px', background: theme.accent1, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Новый профиль</button>
            </div>
          </>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: theme.textSecondary, marginBottom: '8px' }}>Логин</label>
              <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: theme.textSecondary, marginBottom: '8px' }}>Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            {error && <div style={{ padding: '12px', background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, borderRadius: '8px', color: theme.danger, fontSize: '14px', marginBottom: '16px' }}>{error}</div>}
            <button type="submit" style={{ width: '100%', padding: '12px', background: theme.accent1, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Войти</button>
            <button type="button" onClick={() => { setMode('select'); setError(''); setLogin(''); setPassword(''); }} style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'transparent', color: theme.textSecondary, border: 'none', fontSize: '14px', cursor: 'pointer' }}>← Назад</button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: theme.textSecondary, marginBottom: '8px' }}>Отображаемое имя</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Например: Иван" style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: theme.textSecondary, marginBottom: '8px' }}>Логин</label>
              <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Латинские буквы и цифры" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: theme.textSecondary, marginBottom: '8px' }}>Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 3 символа" style={inputStyle} />
            </div>
            {error && <div style={{ padding: '12px', background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, borderRadius: '8px', color: theme.danger, fontSize: '14px', marginBottom: '16px' }}>{error}</div>}
            <button type="submit" style={{ width: '100%', padding: '12px', background: theme.accent1, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Создать профиль</button>
            <button type="button" onClick={() => { setMode('select'); setError(''); setLogin(''); setPassword(''); setDisplayName(''); }} style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'transparent', color: theme.textSecondary, border: 'none', fontSize: '14px', cursor: 'pointer' }}>← Назад</button>
          </form>
        )}
      </div>
    </div>
  );
}
