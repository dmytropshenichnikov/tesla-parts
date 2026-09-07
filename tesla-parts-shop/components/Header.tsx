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

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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

          {/* Right Actions Group: Catalog (Mobile), Search, Cart, Profile, Menu Drawer */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Catalog Button for Mobile / Tablet (Placed to the RIGHT, as requested) */}
            <div className="xl:hidden relative" ref={mobileCategoryRef}>
              <button
                onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                className="flex items-center gap-1 font-bold text-xs sm:text-sm text-gray-800 hover:text-tesla-red transition whitespace-nowrap bg-gray-100 hover:bg-gray-200 py-1.5 px-2.5 sm:px-3 rounded-xl border border-gray-200/80 shadow-xs"
              >
                <span>Каталог</span>
                <ChevronDown size={13} className="text-gray-500" />
              </button>

              {/* Mobile Categories Dropdown */}
              <div
                className={`absolute right-0 top-full mt-2 w-64 bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${isMobileCategoryOpen ? 'block' : 'hidden'}`}
              >
                <div className="py-1 max-h-80 overflow-y-auto">
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
              </div>
            </div>

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

            {/* Profile (Desktop) */}
            <Link
              to="/profile"
              className="hidden sm:flex text-tesla-dark hover:text-tesla-red p-1.5 rounded-full hover:bg-gray-100 transition"
              title="Особистий кабінет"
            >
              <User size={20} />
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

            {/* Mobile Menu Drawer Button (Hamburger) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden p-1.5 text-gray-800 hover:text-tesla-red rounded-lg hover:bg-gray-100 transition"
              aria-label="Відкрити меню"
            >
              <Menu size={22} />
            </button>

            {/* Checkout (Desktop) */}
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
                  placeholder="Пошук запчастин..."
                  className="w-full bg-gray-100 rounded-lg py-3 px-4 pl-10 text-sm"
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
                className="text-tesla-dark p-2"
              >
                <X size={22} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Slide-over Mobile Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-[310px] bg-white h-full shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              {/* Header inside drawer: Logo + Currency pill + Close */}
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
                <TeslaPartsCenterLogo />
                <div className="flex items-center gap-2">
                  {/* Compact Currency Switcher */}
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
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 transition"
                    aria-label="Закрити меню"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="mt-4 flex flex-col">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Меню
                </div>

                <Link
                  to="/reviews"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-red-50/50 rounded-xl transition group mb-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-amber-500">⭐</span>
                    <span>Відгуки про магазин</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>

                {headerPages
                  .filter((page) => page.is_published)
                  .map((page) => (
                    <Link
                      key={page.slug}
                      to={`/info/${page.slug}`}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-950 hover:bg-gray-50 rounded-xl transition group"
                    >
                      <span>{page.title}</span>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  ))}

                <div className="my-2 border-t border-gray-100" />

                <Link
                  to="/profile"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 rounded-xl transition group"
                >
                  <span className="flex items-center gap-2.5">
                    <User size={16} className="text-gray-500" />
                    <span>Особистий кабінет</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              </div>
            </div>

            {/* Bottom: Contacts & Support Card */}
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
