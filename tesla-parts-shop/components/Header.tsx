import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Menu,
  X,
  Instagram,
  Send,
  ChevronDown,
  User,
  Phone,
  ChevronRight,
  Star,
} from 'lucide-react';
import { Category, Currency, Page } from '../types';
import TeslaPartsCenterLogo from './ShopLogo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import { slugify } from '../utils/slugify';
import ViberIcon from './ViberIcon';

interface HeaderProps {
  cartCount: number;
  cartTotalUSD: number;
  currency: Currency;
  uahPerUsd: number;
  categories: Category[];
  setCurrency: (c: Currency) => void;
  onCartClick: () => void;
  onSearch: (query: string) => void;
  socialLinks: {
    instagram: string;
    telegram: string;
    viber: string;
  };
  phoneNumber: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  headerPages: Page[];
  isDrawerOpen?: boolean;
  onOpenDrawer?: () => void;
  onCloseDrawer?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  cartCount,
  cartTotalUSD,
  currency,
  uahPerUsd,
  categories,
  setCurrency,
  onCartClick,
  onSearch,
  socialLinks,
  phoneNumber,
  searchQuery,
  onSearchQueryChange,
  headerPages,
  isDrawerOpen: propIsDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileSearchClosing, setIsMobileSearchClosing] = useState(false);

  const handleOpenMobileSearch = () => {
    setIsMobileSearchClosing(false);
    setIsMobileSearchOpen(true);
  };

  const handleCloseMobileSearch = (shouldClearQuery = false) => {
    if (isMobileSearchClosing) return;
    setIsMobileSearchClosing(true);
    setTimeout(() => {
      setIsMobileSearchOpen(false);
      setIsMobileSearchClosing(false);
      if (shouldClearQuery) {
        onSearchQueryChange('');
      }
    }, 280);
  };

  const [localDrawerOpen, setLocalDrawerOpen] = useState(false);
  const isDrawerOpen = propIsDrawerOpen !== undefined ? propIsDrawerOpen : localDrawerOpen;
  const handleOpenDrawer = onOpenDrawer || (() => setLocalDrawerOpen(true));
  const handleCloseDrawer = onCloseDrawer || (() => setLocalDrawerOpen(false));

  const [isDrawerRendered, setIsDrawerRendered] = useState(isDrawerOpen);
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);

  useEffect(() => {
    if (isDrawerOpen) {
      setIsDrawerRendered(true);
      setIsDrawerClosing(false);
    } else if (isDrawerRendered) {
      setIsDrawerClosing(true);
      const timer = setTimeout(() => {
        setIsDrawerRendered(false);
        setIsDrawerClosing(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [isDrawerOpen, isDrawerRendered]);

  const handleAnimatedCloseDrawer = (afterClose?: () => void) => {
    if (isDrawerClosing) return;
    setIsDrawerClosing(true);
    setTimeout(() => {
      handleCloseDrawer();
      if (afterClose) afterClose();
    }, 260);
  };

  // Дропдаун для десктопа (коли категорій > 4)
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);

  // Дропдаун для мобільного/планшета
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);

  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileCategoryRef = useRef<HTMLDivElement>(null);

  // Закриття при кліку зовні
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        desktopDropdownRef.current &&
        !desktopDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDesktopDropdownOpen(false);
      }
      if (
        mobileCategoryRef.current &&
        !mobileCategoryRef.current.contains(event.target as Node)
      ) {
        setIsMobileCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleSearchChange = (value: string) => {
    onSearchQueryChange(value);
    onSearch(value);
  };

  const formatPrice = (amount: number) => {
    return formatCurrency(amount, currency);
  };
  const displayCartTotal = (() => {
    const rate = uahPerUsd > 0 ? uahPerUsd : 1;
    return currency === Currency.UAH ? cartTotalUSD * rate : cartTotalUSD;
  })();

  const sortedCategories = [...categories].sort(
    (a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0)
  );

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      {/* Top Row: Utilities & Info (Hidden on mobile, shown on desktop) */}
      <div className="hidden md:block bg-tesla-dark text-gray-300 text-xs py-1.5 px-3 sm:px-4 border-b border-gray-800">
        <div className="container mx-auto flex items-center justify-between gap-2">
          {/* Left on Desktop: Phone & Messengers */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {phoneNumber && (
              <a
                href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                className="flex items-center gap-1.5 font-medium text-white hover:text-tesla-red transition text-[11px] sm:text-xs whitespace-nowrap"
                title="Зателефонувати нам"
              >
                <Phone size={12} className="text-emerald-400 fill-emerald-400/20 flex-shrink-0" />
                <span className="tracking-tight">{phoneNumber}</span>
              </a>
            )}

            {/* Messengers */}
            <div className="flex items-center gap-1.5 border-l border-gray-700/80 pl-2">
              {socialLinks.telegram && (
                <a
                  href={socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[#229ED9] transition p-0.5"
                  aria-label="Telegram"
                >
                  <Send size={13} />
                </a>
              )}
              {socialLinks.viber && (
                <a
                  href={`viber://chat?number=${encodeURIComponent(socialLinks.viber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[#7360F2] transition p-0.5"
                  aria-label="Viber"
                >
                  <ViberIcon size={13} color="currentColor" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-tesla-red transition p-0.5"
                  aria-label="Instagram"
                >
                  <Instagram size={13} />
                </a>
              )}
            </div>
          </div>

          {/* Desktop Center: Navigation Pages */}
          <nav className="hidden md:flex flex-wrap gap-4 md:gap-6 justify-center items-center">
            <Link to="/reviews" className="hover:text-white transition">
              Відгуки
            </Link>
            {headerPages
              .filter((page) => page.is_published)
              .map((page) => (
                <Link
                  key={page.slug}
                  to={`/info/${page.slug}`}
                  className="hover:text-white transition"
                >
                  {page.title}
                </Link>
              ))}
          </nav>

          {/* Right: Currency Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Currency Selector (Clean Segmented Control) */}
            <div className="flex items-center bg-gray-800/90 rounded-md p-0.5 border border-gray-700/80">
              {Object.values(Currency).map((cur) => (
                <button
                  key={cur}
                  onClick={() => setCurrency(cur)}
                  className={`px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded transition ${
                    currency === cur
                      ? 'bg-tesla-red text-white shadow-xs'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Row: Logo, Nav, Actions */}
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo (Clean & Roomy on Left) */}
          <TeslaPartsCenterLogo />

          {/* Desktop Navigation (XL+) */}
          <div className="hidden xl:flex items-center gap-6 font-medium text-tesla-dark whitespace-nowrap">
            {sortedCategories.slice(0, 4).map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${slugify(cat.name)}`}
                className="hover:text-tesla-red transition"
              >
                {cat.name}
              </Link>
            ))}
            {sortedCategories.length > 4 && (
              <div className="relative" ref={desktopDropdownRef}>
                <button
                  onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)}
                  className={`flex items-center hover:text-tesla-red transition cursor-pointer ${
                    isDesktopDropdownOpen ? 'text-tesla-red' : ''
                  }`}
                >
                  Усі категорії{' '}
                  <ChevronDown
                    size={16}
                    className={`ml-1 transition-transform duration-300 ${
                      isDesktopDropdownOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
                {isDesktopDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white shadow-xl rounded-xl overflow-hidden border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {sortedCategories.slice(4).map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${slugify(cat.name)}`}
                        onClick={() => setIsDesktopDropdownOpen(false)}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-tesla-red transition-all hover:translate-x-1 duration-150"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <div className="xl:hidden relative" ref={mobileCategoryRef}>
              <button
                onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                className={`flex items-center gap-1.5 font-bold text-xs sm:text-sm text-gray-800 hover:text-tesla-red transition-all whitespace-nowrap bg-gray-100 hover:bg-gray-200 py-1.5 px-2.5 sm:px-3 rounded-xl border border-gray-200/80 shadow-xs active:scale-95 cursor-pointer ${
                  isMobileCategoryOpen ? 'ring-2 ring-tesla-red/20 bg-white border-tesla-red/40 text-tesla-red' : ''
                }`}
              >
                <span>Каталог</span>
                <ChevronDown
                  size={13}
                  className={`text-gray-500 transition-transform duration-300 ${
                    isMobileCategoryOpen ? 'rotate-180 text-tesla-red' : 'rotate-0'
                  }`}
                />
              </button>

              {isMobileCategoryOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 z-50 animate-in fade-in slide-from-top-2 duration-200">
                  <div className="py-1 max-h-80 overflow-y-auto">
                    <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100">
                      Категорії запчастин
                    </div>
                    {sortedCategories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${slugify(cat.name)}`}
                        onClick={() => setIsMobileCategoryOpen(false)}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-red-50 hover:text-tesla-red border-b border-gray-50 last:border-0 font-medium transition-all hover:translate-x-1.5 duration-150"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (document.activeElement as HTMLElement)?.blur();
                handleSearchSubmit(e);
              }}
              className="hidden md:flex items-center gap-2"
            >
              <div className="relative flex-grow w-36 lg:w-48 focus-within:w-72 transition-all duration-300 ease-out group origin-right">
                <input
                  type="text"
                  placeholder="Пошук деталей..."
                  className="w-full bg-gray-100 border border-transparent focus:border-tesla-red/30 rounded-full py-2 px-4 pl-10 pr-8 focus:ring-3 focus:ring-tesla-red/15 focus:bg-white transition-all duration-300 outline-none text-[16px] sm:text-sm text-gray-800 placeholder:text-gray-400 shadow-inner"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.target as HTMLElement).blur();
                      handleSearchSubmit(e);
                    }
                  }}
                />
                <Search
                  className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-tesla-red transition-colors duration-200 pointer-events-none"
                  size={18}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange('');
                      if (location.pathname === '/search') {
                        navigate('/');
                      }
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 bg-gray-200/70 hover:bg-gray-300 rounded-full transition-all duration-150 cursor-pointer active:scale-90"
                    title="Очистити пошук"
                    aria-label="Очистити пошук"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </form>

            <button
              className="md:hidden text-tesla-dark p-2 rounded-full hover:bg-gray-100 active:scale-85 transition-all duration-200 cursor-pointer group"
              onClick={handleOpenMobileSearch}
              aria-label="Пошук"
            >
              <Search size={20} className="transition-transform duration-200 group-hover:rotate-12" />
            </button>

            <Link
              to="/profile"
              className="hidden sm:flex text-tesla-dark hover:text-tesla-red p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-all duration-200"
              title="Особистий кабінет"
            >
              <User size={20} />
            </Link>

            <div
              onClick={onCartClick}
              className="flex items-center gap-2 cursor-pointer group p-1.5 sm:p-1 rounded-xl hover:bg-gray-50 active:scale-90 transition-all duration-200 select-none"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingCart
                  className="text-tesla-dark group-hover:text-tesla-red transition-all duration-200 group-hover:-rotate-12 group-hover:scale-110"
                  size={20}
                />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-tesla-red text-white text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full ring-2 ring-white animate-in zoom-in-50 duration-200">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden lg:block text-sm text-right leading-tight">
                <div className="text-gray-500 text-xs">Кошик</div>
                <div className="font-bold text-tesla-dark group-hover:text-tesla-red transition-colors">
                  {formatPrice(displayCartTotal)}
                </div>
              </div>
            </div>

            <button
              onClick={handleOpenDrawer}
              className="md:hidden p-2 text-gray-800 hover:text-tesla-red rounded-xl hover:bg-gray-100 active:scale-85 transition-all duration-200 cursor-pointer group"
              aria-label="Відкрити меню"
            >
              <Menu size={22} className="transition-transform duration-200 group-hover:scale-110" />
            </button>

            <Link
              to="/checkout"
              className="hidden sm:block bg-tesla-red hover:bg-red-700 active:scale-95 text-white px-4 py-2 rounded-md font-medium transition-all duration-200 text-sm shadow-sm whitespace-nowrap"
            >
              Оформити
            </Link>
          </div>
        </div>

        {isMobileSearchOpen && (
          <div
            className={`md:hidden absolute top-0 left-0 w-full h-full bg-white/95 backdrop-blur-md z-30 flex items-center px-4 shadow-md border-b border-gray-100 ${
              isMobileSearchClosing ? 'animate-search-wave-dismiss' : 'animate-search-wave'
            }`}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (document.activeElement as HTMLElement)?.blur();
                handleSearchSubmit(e);
              }}
              className="flex items-center gap-2 w-full"
            >
              <div className="relative flex-grow animate-input-wave-fluid">
                <input
                  type="text"
                  placeholder="Пошук запчастин..."
                  className="w-full bg-gray-100 focus:bg-white rounded-xl py-2.5 px-4 pl-10 pr-9 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none border border-transparent focus:border-tesla-red/30 focus:ring-2 focus:ring-tesla-red/20 transition-colors shadow-inner"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.target as HTMLElement).blur();
                      handleSearchSubmit(e);
                    }
                  }}
                  autoFocus
                />
                <Search
                  className="absolute left-3 top-3 text-tesla-red pointer-events-none"
                  size={18}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 bg-gray-200/80 hover:bg-gray-300 rounded-full transition-all duration-150 cursor-pointer active:scale-90"
                    title="Очистити поле"
                    aria-label="Очистити поле"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCloseMobileSearch(false)}
                className="text-gray-500 hover:text-tesla-dark p-2 hover:bg-gray-100 rounded-full transition-all duration-200 active:scale-85 hover:rotate-90 cursor-pointer"
                aria-label="Закрити пошук"
              >
                <X size={22} />
              </button>
            </form>
          </div>
        )}
      </div>

      {(isDrawerRendered || isDrawerOpen) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer ${
              isDrawerClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade'
            }`}
            onClick={() => handleAnimatedCloseDrawer()}
          />

          <div
            className={`relative w-full max-w-[320px] bg-white h-full shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto ${
              isDrawerClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
                <TeslaPartsCenterLogo />
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/60">
                    {Object.values(Currency).map((cur) => (
                      <button
                        key={cur}
                        onClick={() => setCurrency(cur)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                          currency === cur
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {cur === Currency.UAH ? '₴ UAH' : '$ USD'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleAnimatedCloseDrawer()}
                    className="p-1.5 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 active:scale-85 transition-all duration-200 hover:rotate-90 cursor-pointer"
                    aria-label="Закрити меню"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Меню
                </div>

                <Link
                  to="/reviews"
                  onClick={() => handleAnimatedCloseDrawer()}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-amber-50/50 rounded-xl transition-all hover:translate-x-1 group mb-1 active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <Star size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
                    <span>Відгуки про магазин</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </Link>

                {headerPages
                  .filter((page) => page.is_published)
                  .map((page, idx) => (
                    <Link
                      key={page.slug}
                      to={`/info/${page.slug}`}
                      onClick={() => handleAnimatedCloseDrawer()}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-950 hover:bg-gray-50 rounded-xl transition-all hover:translate-x-1 group active:scale-[0.98]"
                    >
                      <span>{page.title}</span>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}

                <div className="my-2 border-t border-gray-100" />

                <Link
                  to="/profile"
                  onClick={() => handleAnimatedCloseDrawer()}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 rounded-xl transition-all hover:translate-x-1 group active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <User size={16} className="text-gray-500" />
                    <span>Особистий кабінет</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-6">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">
                Контакти та консультація
              </div>

              {/* Direct Call Card */}
              {phoneNumber && (
                <a
                  href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-950 hover:bg-black text-white transition group shadow-xs mb-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Phone size={15} />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase font-semibold">Телефон</div>
                      <div className="text-xs sm:text-sm font-bold tracking-tight font-mono text-white">
                        {phoneNumber}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Подзвонити
                  </span>
                </a>
              )}

              {/* Messengers Row */}
              <div className="grid grid-cols-2 gap-2">
                {socialLinks.telegram && (
                  <a
                    href={socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#0088cc] border border-[#229ED9]/20 text-xs font-semibold transition shadow-2xs"
                  >
                    <Send size={14} />
                    <span>Telegram</span>
                  </a>
                )}
                {socialLinks.viber && (
                  <a
                    href={`viber://chat?number=${encodeURIComponent(socialLinks.viber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#7360F2]/10 hover:bg-[#7360F2]/20 text-[#6250e0] border border-[#7360F2]/20 text-xs font-semibold transition shadow-2xs"
                  >
                    <ViberIcon size={14} color="#6250e0" />
                    <span>Viber</span>
                  </a>
                )}
              </div>

              {/* Copyright */}
              <div className="mt-4 text-center text-[11px] text-gray-400">
                Tesla Parts Center &copy; {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
export default Header;
