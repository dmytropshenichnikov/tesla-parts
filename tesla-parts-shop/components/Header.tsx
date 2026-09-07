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
} from 'lucide-react';
import { Category, Currency, Page } from '../types';
import TeslaPartsCenterLogo from './ShopLogo';
import { Link } from 'react-router-dom';
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
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Дропдаун для десктопа (коли категорій > 4)
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);

  // Дропдаун для мобільного/планшета (замість бургера)
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
      {/* Top Row: Utilities & Info */}
      <div className="bg-tesla-dark text-gray-300 text-xs py-1.5 px-3 sm:px-4 border-b border-gray-800">
        <div className="container mx-auto flex items-center justify-between gap-2">
          {/* Left on Mobile / Left on Desktop: Phone & Messengers */}
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

      {/* Second Row: Main Nav, Logo, Cart */}
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <TeslaPartsCenterLogo />

          {/* === НАВІГАЦІЯ КАТЕГОРІЙ === */}
          <div className="flex-1 max-w-2xl px-1 sm:px-4 md:px-8">
            {/* 1. ВАРІАНТ ДЛЯ ВЕЛИКИХ ДЕСКТОПІВ (XL+) - Повний список */}
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
                    onClick={() =>
                      setIsDesktopDropdownOpen(!isDesktopDropdownOpen)
                    }
                    className="flex items-center hover:text-tesla-red transition"
                  >
                    Усі категорії <ChevronDown size={16} className="ml-1" />
                  </button>
                  <div
                    className={`absolute left-0 top-full mt-2 w-48 bg-white shadow-lg rounded-md overflow-hidden z-10 ${isDesktopDropdownOpen ? 'block' : 'hidden'}`}
                  >
                    {sortedCategories.slice(4).map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${slugify(cat.name)}`}
                        onClick={() => setIsDesktopDropdownOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. ВАРІАНТ ДЛЯ МОБІЛЬНИХ/ПЛАНШЕТІВ (< XL) - Кнопка "Каталог" */}
            <div className="xl:hidden relative" ref={mobileCategoryRef}>
              <button
                onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-gray-800 hover:text-tesla-red transition whitespace-nowrap bg-gray-100 hover:bg-gray-200 py-1.5 px-2.5 sm:px-3 rounded-lg border border-gray-200 shadow-xs"
              >
                <Menu size={14} className="text-gray-600" />
                <span>Каталог</span>
                <ChevronDown size={13} className="text-gray-500" />
              </button>

              {/* Випадаюче меню для мобілок (Каталог + Інформація) */}
              <div
                className={`absolute left-0 top-full mt-2 w-64 bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${isMobileCategoryOpen ? 'block' : 'hidden'}`}
              >
                <div className="py-1 max-h-72 overflow-y-auto">
                  <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100">
                    Категорії запчастин
                  </div>
                  {sortedCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/category/${slugify(cat.name)}`}
                      onClick={() => setIsMobileCategoryOpen(false)}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-red-50 hover:text-tesla-red border-b border-gray-50 last:border-0 font-medium transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>

                {/* Інформаційні сторінки магазину */}
                <div className="border-t border-gray-100 bg-gray-50/80 py-2">
                  <div className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Інформація
                  </div>
                  <Link
                    to="/reviews"
                    onClick={() => setIsMobileCategoryOpen(false)}
                    className="block px-4 py-2 text-xs text-gray-700 hover:text-tesla-red font-medium transition-colors"
                  >
                    ⭐ Відгуки про магазин
                  </Link>
                  {headerPages
                    .filter((page) => page.is_published)
                    .map((page) => (
                      <Link
                        key={page.slug}
                        to={`/info/${page.slug}`}
                        onClick={() => setIsMobileCategoryOpen(false)}
                        className="block px-4 py-1.5 text-xs text-gray-600 hover:text-tesla-red transition-colors"
                      >
                        {page.title}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions: Search, Cart, Profile, Checkout */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Desktop Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex items-center gap-2"
            >
              <div className="relative flex-grow w-32 lg:w-auto">
                <input
                  type="text"
                  placeholder="Пошук..."
                  className="w-full bg-gray-100 border-none rounded-full py-2 px-4 pl-10 focus:ring-2 focus:ring-tesla-red focus:bg-white transition outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                <Search
                  className="absolute left-3 top-2.5 text-gray-400"
                  size={18}
                />
              </div>
            </form>

            {/* Mobile Search Toggle */}
            <button
              className="md:hidden text-tesla-dark p-1.5 rounded-full hover:bg-gray-100 transition"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Пошук"
            >
              <Search size={20} />
            </button>

            {/* Profile */}
            <Link
              to="/profile"
              className="text-tesla-dark hover:text-tesla-red p-1.5 rounded-full hover:bg-gray-100 transition"
              title="Особистий кабінет"
            >
              <User size={20} className="sm:w-6 sm:h-6" />
            </Link>

            {/* Cart */}
            <div
              onClick={onCartClick}
              className="flex items-center gap-2 cursor-pointer group p-1 sm:p-0"
            >
              <div className="relative">
                <ShoppingCart
                  className="text-tesla-dark group-hover:text-tesla-red transition"
                  size={20}
                />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-tesla-red text-white text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden lg:block text-sm text-right leading-tight">
                <div className="text-gray-500 text-xs">Кошик</div>
                <div className="font-bold text-tesla-dark">
                  {formatPrice(displayCartTotal)}
                </div>
              </div>
            </div>

            {/* Checkout */}
            <Link
              to="/checkout"
              className="hidden sm:block bg-tesla-red hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition text-sm shadow-sm whitespace-nowrap"
            >
              Оформити
            </Link>
          </div>
        </div>

        {/* Mobile Search Overlay */}
        {isMobileSearchOpen && (
          <div className="md:hidden absolute top-0 left-0 w-full h-full bg-white z-20 flex items-center px-4">
            <form
              onSubmit={(e) => {
                handleSearchSubmit(e);
                setIsMobileSearchOpen(false);
              }}
              className="flex items-center gap-2 w-full"
            >
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Пошук..."
                  className="w-full bg-gray-100 rounded-lg py-3 px-4 pl-10"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                />
                <Search
                  className="absolute left-3 top-3.5 text-gray-400"
                  size={18}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="text-tesla-dark"
              >
                <X size={24} />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
