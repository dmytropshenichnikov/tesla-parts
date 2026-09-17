import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { api } from '../services/api';

interface AuthContextType {
  isCustomerLoggedIn: boolean;
  customerProfile: any | null;
  loginCustomer: (token: string) => Promise<void>;
  logoutCustomer: () => void;
  updateProfileState: (data: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem('customerToken');
  });
  const [customerProfile, setCustomerProfile] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    if (token) {
      setIsCustomerLoggedIn(true);
      fetchProfile();
    }

    const handleLogout = () => {
      localStorage.removeItem('customerToken');
      // Гараж належить акаунту, а не пристрою: після виходу (або протермінованої
      // сесії) прибираємо його з браузера — на спільному пристрої наступна людина
      // не побачить чужі авто. На сервері вони лишаються, тож нічого не губиться.
      // Робимо це саме тут, бо провайдер змонтований завжди, а сторінка гаража — ні.
      localStorage.removeItem('tesla_garage_all_cars');
      localStorage.removeItem('tesla_garage_active_car');
      window.dispatchEvent(new Event('garage-car-changed'));
      setIsCustomerLoggedIn(false);
      setCustomerProfile(null);
    };

    window.addEventListener('customer-logged-out', handleLogout);
    return () =>
      window.removeEventListener('customer-logged-out', handleLogout);
  }, []);

  const fetchProfile = async () => {
    try {
      const profile = await api.getMe();
      setCustomerProfile(profile);
    } catch (error) {
      console.error('Failed to fetch profile', error);
      // Auto logout will trigger if 401
    }
  };

  const loginCustomer = async (token: string) => {
    localStorage.setItem('customerToken', token);
    setIsCustomerLoggedIn(true);
    await fetchProfile();
  };

  const logoutCustomer = async () => {
    try {
      await api.logoutCustomer();
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('customerToken');
    setIsCustomerLoggedIn(false);
    setCustomerProfile(null);
    // Повідомляємо решту застосунку: раніше подія летіла лише при 401, тож при
    // звичайному виході гараж і каталог далі показували дані акаунта.
    window.dispatchEvent(new Event('customer-logged-out'));
  };

  const updateProfileState = (data: any) => {
    setCustomerProfile(data);
  };

  return (
    <AuthContext.Provider
      value={{
        isCustomerLoggedIn,
        customerProfile,
        loginCustomer,
        logoutCustomer,
        updateProfileState,
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
