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
  Layers,
  Car,
} from 'lucide-react';
import { Category, Currency, Page, SavedCar } from '../types';
import { GarageModal } from './GarageModal';
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
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [activeCar, setActiveCar] = useState<SavedCar | null>(null);

  useEffect(() => {
    const loadCar = () => {
      try {
        const saved = localStorage.getItem('tesla_garage_active_car');
        setActiveCar(saved ? JSON.parse(saved) : null);
      } catch (e) {
        console.error(e);
      }
    };
    loadCar();
    const handleOpenGarage = () => setIsGarageOpen(true);
    window.addEventListener('garage-car-changed', loadCar);
    window.addEventListener('open-garage-modal', handleOpenGarage);
    return () => {
      window.removeEventListener('garage-car-changed', loadCar);
      window.removeEventListener('open-garage-modal', handleOpenGarage);
    };
  }, []);

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

  const isTeslaVin = (val: string) => {
    const clean = val.trim().toUpperCase();
    return clean.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(clean);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().toUpperCase();
    if (isTeslaVin(clean)) {
      navigate(`/schemes?vin=${encodeURIComponent(clean)}`);
      return;
    }
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
    <header className="bg-white/95 backdrop-blur-md shadow-xs border-b border-gray-100 sticky top-0 z-50 transition-all">
      {/* Single Unified Header Row */}
      <div className="max-w-[1680px] w-full mx-auto px-3 sm:px-5 xl:px-6 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-3 xl:gap-6">
          {/* Logo (Clean & Compact on Left) */}
          <TeslaPartsCenterLogo />

          {/* Center Navigation (LG+) */}
          <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 text-sm">
            {/* Catalog Mega-Menu Trigger */}
            <div className="relative" ref={desktopDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-montserrat font-bold transition-all cursor-pointer ${
                  isDesktopDropdownOpen
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'text-gray-800 hover:text-tesla-red hover:bg-gray-50'
                }`}
              >
                <span>Каталог</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    isDesktopDropdownOpen ? 'rotate-180 text-tesla-red' : 'text-gray-400'
                  }`}
                />
              </button>

              {/* Mega-Menu Dropdown Panel */}
              {isDesktopDropdownOpen && (
                <div className="absolute top-full left-0 mt-2.5 w-[640px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 font-montserrat">
                      Моделі Tesla
                    </span>
                    <Link
                      to="/schemes"
                      onClick={() => setIsDesktopDropdownOpen(false)}
                      className="text-xs font-montserrat font-bold text-tesla-red hover:underline flex items-center gap-1"
                    >
                      <Layers size={13} />
                      <span>Перейти до вибух-схем EPC</span>
                    </Link>
                  </div>

                  {/* Model Cards Grid */}
                  <div className="grid grid-cols-5 gap-2.5 mb-4">
                    {sortedCategories.slice(0, 5).map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${slugify(cat.name)}`}
                        onClick={() => setIsDesktopDropdownOpen(false)}
                        className="group flex flex-col items-center text-center p-2.5 rounded-2xl bg-gray-50/80 hover:bg-red-50/60 border border-gray-100 hover:border-red-200 transition-all active:scale-95"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden mb-2 bg-gray-200/50 flex items-center justify-center">
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <Car size={24} className="text-gray-400 group-hover:text-tesla-red transition-colors" />
                          )}
                        </div>
                        <span className="font-montserrat font-bold text-xs text-gray-900 group-hover:text-tesla-red transition-colors leading-tight">
                          {cat.name}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* Subcategories & All Categories */}
                  {sortedCategories.length > 5 && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1 font-montserrat">
                        Усі категорії
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        {sortedCategories.slice(5).map((cat) => (
                          <Link
                            key={cat.id}
                            to={`/category/${slugify(cat.name)}`}
                            onClick={() => setIsDesktopDropdownOpen(false)}
                            className="px-2.5 py-1.5 rounded-lg text-gray-700 hover:text-tesla-red hover:bg-red-50/50 font-medium transition-colors truncate"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Schemes Link */}
            <Link
              to="/schemes"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-800 hover:text-tesla-red hover:bg-gray-50 font-montserrat font-bold transition-all text-sm group"
            >
              <Layers size={16} className="text-tesla-red group-hover:scale-110 transition-transform" />
              <span>Схеми</span>
            </Link>

            {/* My Garage Link */}
            <Link
              to="/garage"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-montserrat font-bold transition-all border text-xs shadow-2xs ${
                activeCar
                  ? 'bg-red-50/80 text-gray-900 border-red-200 hover:bg-red-100'
                  : 'bg-gray-50 text-gray-800 border-gray-200/80 hover:bg-gray-100 hover:text-tesla-red'
              }`}
              title={activeCar ? `Ваша Tesla: ${activeCar.model}` : 'Перейти в Мій Гараж'}
            >
              <Car size={15} className="text-tesla-red flex-shrink-0" />
              {activeCar ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-normal">Гараж:</span>
                  <span className="text-gray-950 font-black tracking-tight">{activeCar.plate || activeCar.model}</span>
                </span>
              ) : (
                <span>Мій Гараж</span>
              )}
            </Link>
          </div>

          {/* Right Action Block: Search, Currency, Phone, Profile, Cart */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 xl:gap-3 flex-shrink-0">
            {/* Quick Catalog on Mobile */}
            <div className="lg:hidden flex items-center gap-1">
              <div className="relative" ref={mobileCategoryRef}>
                <button
                  onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                  className={`flex items-center gap-1 font-montserrat font-bold text-xs text-gray-800 hover:text-tesla-red transition-all whitespace-nowrap bg-gray-100 hover:bg-gray-200 py-1.5 px-2.5 rounded-xl border border-gray-200/80 shadow-xs active:scale-95 cursor-pointer ${
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
                  <div className="fixed inset-x-3 top-[54px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200 divide-y divide-gray-100 max-w-sm sm:max-w-none ml-auto">
                    {/* Garage & Schemes on Mobile */}
                    <div className="p-2 bg-gradient-to-b from-gray-50/80 to-white space-y-1">
                      <Link
                        to="/garage"
                        onClick={() => setIsMobileCategoryOpen(false)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-100 text-gray-900 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-tesla-red border border-red-100 flex items-center justify-center shrink-0">
                          <Car size={16} />
                        </div>
                        <div>
                          <div className="font-montserrat font-bold text-xs">
                            {activeCar ? `Гараж: ${activeCar.plate || activeCar.model}` : 'Мій Гараж'}
                          </div>
                          <div className="text-[11px] text-gray-400 font-manrope">За номером авто або VIN</div>
                        </div>
                      </Link>

                      <Link
                        to="/schemes"
                        onClick={() => setIsMobileCategoryOpen(false)}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 text-gray-900 hover:text-tesla-red transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center shrink-0">
                          <Layers size={16} className="text-tesla-red" />
                        </div>
                        <div>
                          <div className="font-montserrat font-bold text-xs">Схеми запчастин</div>
                          <div className="text-[11px] text-gray-400 font-manrope">Інтерактивні вибух-схеми EPC</div>
                        </div>
                      </Link>
                    </div>

                    <div className="py-1 max-h-80 overflow-y-auto">
                      <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100 font-montserrat">
                        Моделі та категорії
                      </div>
                      {sortedCategories.map((cat) => (
                        <Link
                          key={cat.id}
                          to={`/category/${slugify(cat.name)}`}
                          onClick={() => setIsMobileCategoryOpen(false)}
                          className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-red-50 hover:text-tesla-red border-b border-gray-50 last:border-0 font-medium transition-all hover:translate-x-1 duration-150"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expandable Search Form (Desktop) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (document.activeElement as HTMLElement)?.blur();
                handleSearchSubmit(e);
              }}
              className="hidden md:flex items-center"
            >
              <div className="relative w-36 lg:w-44 xl:w-56 focus-within:w-60 xl:focus-within:w-72 transition-all duration-300 ease-out group">
                <input
                  type="text"
                  placeholder="Пошук деталей або VIN..."
                  className="w-full bg-gray-100 border border-transparent focus:border-red-300 rounded-full py-2 px-4 pl-9 pr-7 focus:ring-3 focus:ring-red-500/10 focus:bg-white transition-all duration-200 outline-none text-xs text-gray-900 placeholder:text-gray-400 shadow-inner"
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
                  size={15}
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 bg-gray-200/80 rounded-full cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </form>

            {/* Mobile Search Button */}
            <button
              className="md:hidden text-gray-700 p-2 rounded-xl hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
              onClick={handleOpenMobileSearch}
              aria-label="Пошук"
            >
              <Search size={19} />
            </button>

            {/* Currency Selector (Sleek Micro Pill) */}
            <div className="hidden sm:flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/70">
              {Object.values(Currency).map((cur) => (
                <button
                  key={cur}
                  onClick={() => setCurrency(cur)}
                  className={`px-2 py-0.5 text-[11px] font-montserrat font-bold rounded-md transition cursor-pointer ${
                    currency === cur
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>

            {/* Phone Call Button (Desktop) */}
            {phoneNumber && (
              <a
                href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 text-gray-700 hover:text-gray-950 transition-all text-xs font-semibold"
                title="Зателефонувати нам"
              >
                <Phone size={14} className="text-emerald-500" />
                <span className="font-mono">{phoneNumber}</span>
              </a>
            )}

            {/* Profile Link */}
            <Link
              to="/profile"
              className="hidden sm:flex text-gray-700 hover:text-tesla-red p-2 rounded-xl hover:bg-gray-50 active:scale-90 transition-all"
              title="Особистий кабінет"
            >
              <User size={19} />
            </Link>

            {/* Unified Luxury Cart Button */}
            <button
              type="button"
              onClick={onCartClick}
              className="flex items-center gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gray-950 hover:bg-black text-white active:scale-95 transition-all shadow-sm cursor-pointer group select-none flex-shrink-0"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingCart size={17} className="text-gray-300 group-hover:text-white transition-colors" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 bg-tesla-red text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-gray-950 animate-in zoom-in duration-150">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[9px] text-gray-400 uppercase font-montserrat font-bold tracking-wider">
                  {cartCount > 0 ? `${cartCount} шт` : 'Кошик'}
                </div>
                <div className="font-montserrat font-black text-xs text-white">
                  {formatPrice(displayCartTotal)}
                </div>
              </div>
            </button>

            {/* Mobile Burger Menu Button */}
            <button
              onClick={handleOpenDrawer}
              className="lg:hidden p-2 text-gray-800 hover:text-tesla-red rounded-xl hover:bg-gray-100 active:scale-85 transition-all cursor-pointer"
              aria-label="Відкрити меню"
            >
              <Menu size={22} />
            </button>
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
                  to="/schemes"
                  onClick={() => handleAnimatedCloseDrawer()}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-red-50/50 rounded-xl transition-all hover:translate-x-1 group mb-1 active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers size={16} className="text-tesla-red flex-shrink-0" />
                    <span>Схеми запчастин</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    handleAnimatedCloseDrawer();
                    setIsGarageOpen(true);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded-xl transition-all hover:translate-x-1 group mb-1 active:scale-[0.98] text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Car size={16} className="text-tesla-red flex-shrink-0" />
                    <span>{activeCar ? `Гараж: ${activeCar.model}` : 'Мій гараж'}</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </button>

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

      {/* Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        onCarSaved={(car) => setActiveCar(car)}
      />
    </header>
  );
};
export default Header;
