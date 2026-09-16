import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { ApiService, setUnauthorizedCallback } from './services/api'; // Import setUnauthorizedCallback

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
  resetError: () => void;
  refreshAccessToken: () => Promise<void>;
  showSessionExpiredModal: boolean;
  setShowSessionExpiredModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('refreshToken')
  );
  const [error, setError] = useState<string | null>(null);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false); // New state

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    } else {
      localStorage.removeItem('accessToken');
    }
  }, [accessToken]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }, [refreshToken]);

  // Set up the callback for ApiService to use when an unauthorized error occurs
  useEffect(() => {
    setUnauthorizedCallback(() => {
      // Викликається з ApiService, коли оновити токен не вдалось
      handleLogoutError();
    });
  }, []); // Run once on mount

  // ApiService оновлює токен сам (напр. посеред збереження схеми) і повідомляє
  // про це подією — тримаємо стан React у синхроні з localStorage
  useEffect(() => {
    const handleTokensRefreshed = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.accessToken) setAccessToken(detail.accessToken);
      if (detail.refreshToken) setRefreshToken(detail.refreshToken);
      setShowSessionExpiredModal(false);
    };

    window.addEventListener('admin-tokens-refreshed', handleTokensRefreshed);
    return () => window.removeEventListener('admin-tokens-refreshed', handleTokensRefreshed);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setShowSessionExpiredModal(false); // Clear modal on new login attempt
      const response = await ApiService.login(username, password);
      setAccessToken(response.access_token);
      setRefreshToken(response.refresh_token);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      throw err;
    }
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setShowSessionExpiredModal(false); // Ensure modal is hidden on explicit logout
  };

  /**
   * Сесія протухла. Токени НЕ чистимо й зі сторінки не викидаємо: показуємо
   * вікно повторного входу поверх поточної сторінки, щоб незбережена робота
   * (схема з точками, форма товару тощо) залишилась на екрані.
   */
  const handleLogoutError = () => {
    setShowSessionExpiredModal(true);
  };

  const refreshAccessToken = async () => {
    const stored = refreshToken || localStorage.getItem('refreshToken');
    if (!stored) {
      handleLogoutError(); // Немає чим оновлювати — просимо увійти знову
      throw new Error('No refresh token available');
    }
    try {
      const response = await ApiService.refreshToken(stored);
      setAccessToken(response.access_token);
      setRefreshToken(response.refresh_token);
      setShowSessionExpiredModal(false);
    } catch (err: any) {
      console.error('Failed to refresh token:', err);
      handleLogoutError();
      throw err;
    }
  };

  const resetError = () => {
    setError(null);
  };

  const isAuthenticated = !!accessToken;

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        refreshToken,
        login,
        logout,
        isAuthenticated,
        error,
        resetError,
        refreshAccessToken,
        showSessionExpiredModal,
        setShowSessionExpiredModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
