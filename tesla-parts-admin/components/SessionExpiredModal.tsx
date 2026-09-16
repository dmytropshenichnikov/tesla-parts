import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext';

/**
 * Вікно повторного входу поверх поточної сторінки.
 *
 * Навмисно НЕ перекидає на /login: сторінка з незбереженою роботою (схема з
 * точками, форма товару) лишається на екрані, а після входу можна одразу
 * натиснути «Зберегти» ще раз — нічого не втрачається.
 */
export const SessionExpiredModal: React.FC = () => {
  const { showSessionExpiredModal, login, logout } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showSessionExpiredModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      await login(username, password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Не вдалося увійти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Lock size={18} />
          </div>
          <div>
            <h2 className="font-montserrat font-bold text-gray-900">Сесія завершилась</h2>
            <p className="text-xs text-gray-500 font-manrope mt-0.5">
              Ваші зміни на екрані збережено. Увійдіть, щоб продовжити — і натисніть
              «Зберегти» ще раз.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
              Імʼя користувача
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold font-montserrat text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-manrope focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs font-manrope">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-montserrat font-bold transition-colors cursor-pointer"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {busy ? 'Вхід...' : 'Увійти й продовжити'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full text-xs text-gray-400 hover:text-gray-700 font-manrope cursor-pointer"
          >
            Вийти й очистити сесію
          </button>
        </form>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
