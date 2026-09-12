import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Menu,
  LogOut,
  Car,
  Layers,
  FileText,
  Key,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Mail,
  Users,
  Ticket,
  FolderTree,
  Star,
  Search,
} from 'lucide-react';
import { useAuth } from '../AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    to={to}
    title={collapsed ? label : undefined}
    className={`flex items-center rounded-lg transition-all duration-200 ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'} ${
      active
        ? 'bg-red-600 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    <Icon size={20} className="shrink-0" />
    {!collapsed && (
      <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-200">
        {label}
      </span>
    )}
  </Link>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/':
        return 'Огляд';
      case '/products':
        return 'Товари';
      case '/orders':
        return 'Замовлення';
      case '/categories':
        return 'Категорії';
      case '/reviews':
        return 'Відгуки';
      case '/settings':
        return 'Налаштування';
      case '/cms':
        return 'Контент';
      case '/customers':
        return 'Клієнти';
      case '/promocodes':
        return 'Промокоди';
      case '/email-campaigns':
        return 'Розсилки';
      case '/search-analytics':
        return 'Пошукова аналітика';
      default:
        return 'Адмін Панель';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-900 text-white transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        <div
          className={`flex items-center border-b border-gray-800 transition-all duration-300 shrink-0 ${collapsed ? 'justify-center p-4' : 'gap-2 p-6'}`}
        >
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center shrink-0">
            <span className="font-bold text-white text-lg">T</span>
          </div>
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300">
              Tesla Admin
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          <SidebarItem
            to="/"
            icon={LayoutDashboard}
            label="Дашборд"
            active={location.pathname === '/'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/orders"
            icon={ShoppingCart}
            label="Замовлення"
            active={location.pathname === '/orders'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/categories"
            icon={Layers}
            label="Категорії"
            active={location.pathname === '/categories'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/reviews"
            icon={MessageSquare}
            label="Відгуки"
            active={location.pathname === '/reviews'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/products"
            icon={Layers}
            label="Товари"
            active={location.pathname === '/products'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/settings"
            icon={Settings}
            label="Налаштування"
            active={location.pathname === '/settings'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/settings/reset-password"
            icon={Key}
            label="Змінити Пароль"
            active={location.pathname === '/settings/reset-password'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/cms"
            icon={FileText}
            label="Контент"
            active={location.pathname === '/cms'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/customers"
            icon={Users}
            label="Клієнти"
            active={location.pathname === '/customers'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/promocodes"
            icon={Ticket}
            label="Промокоди"
            active={location.pathname === '/promocodes'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/email-campaigns"
            icon={Mail}
            label="Розсилки"
            active={location.pathname === '/email-campaigns'}
            collapsed={collapsed}
          />
          <SidebarItem
            to="/search-analytics"
            icon={Search}
            label="Пошукові запити"
            active={location.pathname === '/search-analytics'}
            collapsed={collapsed}
          />
        </nav>

        <div className="shrink-0 w-full p-4 border-t border-gray-800 bg-gray-900">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Вийти' : undefined}
            className={`flex items-center rounded-lg text-gray-400 hover:text-white transition-all duration-200 w-full ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}`}
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && (
              <span className="whitespace-nowrap overflow-hidden">Вийти</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu size={24} />
              </button>
              <button
                className="hidden lg:flex p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-gray-800">
                {getPageTitle(location.pathname)}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm border border-red-200">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
