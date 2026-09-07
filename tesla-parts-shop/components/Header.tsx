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

  const [isPagesDropdownOpen, setIsPagesDropdownOpen] = useState(false);

  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileCategoryRef = useRef<HTMLDivElement>(null);
  const pagesDropdownRef = useRef<HTMLDivElement>(null);

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
      if (
        pagesDropdownRef.current &&
        !pagesDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPagesDropdownOpen(false);
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
      <div className="bg-tesla-dark text-gray-300 text-xs py-2 px-4 border-b border-gray-800">
        <div className="container mx-auto flex flex-row w-full justify-between items-center gap-2">
          <nav className="hidden md:flex flex-wrap gap-4 md:gap-6 justify-center md:justify-start">
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

          <div className="relative md:hidden" ref={pagesDropdownRef}>
            <button
              onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
              className="flex items-center gap-1 hover:text-white transition"
            >
              Навігація
              <ChevronDown size={16} />
            </button>
            {isPagesDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-white shadow-lg rounded-md overflow-hidden z-20">
                <Link
                  to="/reviews"
                  onClick={() => setIsPagesDropdownOpen(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100"
                >
                  Відгуки
                </Link>
                {headerPages
                  .filter((page) => page.is_published)
                  .map((page) => (
                    <Link
                      key={page.slug}
                      to={`/info/${page.slug}`}
                      onClick={() => setIsPagesDropdownOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {page.title}
                    </Link>
                  ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {phoneNumber && (
              <a
                href={`tel:${phoneNumber}`}
                className="hover:text-white transition"
              >
                {phoneNumber}
              </a>
            )}
            <div className="flex items-center gap-2">
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-tesla-red transition"
                >
                  <Instagram size={16} />
                </a>
              )}
              {socialLinks.telegram && (
                <a
                  href={socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-tesla-red transition"
                >
                  <Send size={16} />
                </a>
              )}
              {socialLinks.viber && (
                <a
                  href={`viber://chat?number=${encodeURIComponent(socialLinks.viber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-tesla-red transition"
                >
                  <ViberIcon size={16} color="currentColor" />
                </a>
              )}
            </div>
            <div className="border-l border-gray-700 pl-4 flex gap-2">
              {Object.values(Currency).map((cur) => (
                <button
                  key={cur}
                  onClick={() => setCurrency(cur)}
                  className={`font-semibold ${currency === cur ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
          <div className="flex-1 max-w-2xl px-2 sm:px-4 md:px-8">
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

            {/* 2. ВАРІАНТ ДЛЯ МОБІЛЬНИХ/ПЛАНШЕТІВ (< XL) - Тільки кнопка "Усі категорії" */}
            <div className="xl:hidden relative" ref={mobileCategoryRef}>
              <button
                onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                className="flex items-center font-medium text-xs sm:text-sm text-tesla-dark hover:text-tesla-red transition whitespace-nowrap bg-gray-50 hover:bg-gray-100 py-1.5 px-2.5 rounded-lg border border-gray-200"
              >
                <span>Категорії</span> <ChevronDown size={14} className="ml-1 text-gray-500" />
              </button>

              {/* Випадаюче меню для мобілок */}
              <div
                className={`absolute left-0 top-full mt-2 w-56 bg-white shadow-xl rounded-lg overflow-hidden border border-gray-100 z-30 ${isMobileCategoryOpen ? 'block' : 'hidden'}`}
              >
                {sortedCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${slugify(cat.name)}`}
                    onClick={() => setIsMobileCategoryOpen(false)}
                    className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0 font-medium"
                  >
                    {cat.name}
                  </Link>
                ))}
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
