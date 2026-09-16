import React from 'react';

/**
 * Силует Tesla (вид збоку) для карток авто.
 *
 * Емодзі не використовуємо — тільки SVG. Форма кузова й розмір залежать від
 * моделі: седани (Model 3 / S) — низькі й компактні, кросовери (Model Y / X) —
 * вищі, Cybertruck — найбільший і з гранованим «клином».
 *
 * Геометрія навмисно проста: жирний силует + два колеса з білою серединою.
 * Дрібні деталі на 24px перетворюються на бруд, тому їх немає.
 */
export type TeslaBodyVariant = 'sedan' | 'suv' | 'pickup';

/** Висота іконки в пікселях під конкретну модель. */
const MODEL_HEIGHT: Record<string, number> = {
  'model 3': 24,
  'model 3 highland': 24,
  'model s': 26,
  'model y': 30,
  'model y juniper': 30,
  'model x': 33,
  cybertruck: 36,
};

export const teslaBodyVariant = (model?: string): TeslaBodyVariant => {
  const value = (model || '').toLowerCase();
  if (value.includes('cybertruck')) return 'pickup';
  if (value.includes('model y') || value.includes('model x')) return 'suv';
  return 'sedan';
};

export const teslaIconHeight = (model?: string): number => {
  const value = (model || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (MODEL_HEIGHT[value]) return MODEL_HEIGHT[value];
  const match = Object.keys(MODEL_HEIGHT).find((key) => value.includes(key));
  return match ? MODEL_HEIGHT[match] : 26;
};

/* --- Кузови (viewBox 0 0 64 24, вид збоку, земля на y≈17.4) --- */

/** Седан: довгий низький силует, плавний дах. */
const SEDAN_BODY =
  'M3.4 17.4 C3.4 14.8 4.6 13 7.4 12.2 L14.6 9.8 C16.2 7.2 18.8 5.8 21.8 5.8 ' +
  'L34.6 5.8 C37.8 5.8 40.6 7.2 42.6 9.6 L46.4 13.9 L56.8 14.8 ' +
  'C59.8 15.1 61.6 16 61.6 17.4 Z';

/** Кросовер: вищий дах, вища посадка. */
const SUV_BODY =
  'M3.4 17.4 C3.4 14.4 4.8 12.4 7.8 11.4 L13.8 8.4 C15.6 5.4 18.6 4 22.2 4 ' +
  'L37.8 4 C41.6 4 44.6 5.6 46.8 8.4 L50.8 13.2 L57.4 14.2 ' +
  'C60.2 14.6 61.6 15.6 61.6 17.4 Z';

/** Cybertruck: гранований клин із пласким кузовом ззаду. */
const PICKUP_BODY =
  'M3.4 17.4 L4.2 13 L10.8 6 L21.4 4.2 L31 11.2 L61.6 11.2 L61.6 17.4 Z';

const BODY_PATHS: Record<TeslaBodyVariant, string> = {
  sedan: SEDAN_BODY,
  suv: SUV_BODY,
  pickup: PICKUP_BODY,
};

/** Вікна: вирізи в силуеті кузова. */
const WINDOW_PATHS: Record<TeslaBodyVariant, string> = {
  sedan: 'M16.6 12.2 L22.6 7.2 L33.4 7.2 L39.2 12.2 Z',
  suv: 'M16.2 11.4 L22.6 5.6 L37.2 5.6 L43.4 11.4 Z',
  pickup: 'M13.4 11.6 L21.4 6.4 L28.8 11.6 Z',
};

const WHEEL_FRONT_X = 14.8;
const WHEEL_REAR_X = 48.2;
const WHEEL_Y = 17.4;
const WHEEL_R = 4.1;

const Wheel: React.FC<{ x: number }> = ({ x }) => (
  <>
    <circle cx={x} cy={WHEEL_Y} r={WHEEL_R} fill="#ffffff" stroke="currentColor" strokeWidth={2.2} />
    <circle cx={x} cy={WHEEL_Y} r={1.2} fill="currentColor" />
  </>
);

interface Props {
  /** Модель авто: «Model 3», «Model Y», «Model Y Juniper», «Cybertruck»… */
  model?: string;
  /** Перекрити висоту в px. */
  height?: number;
  className?: string;
}

export const TeslaCarIcon: React.FC<Props> = ({ model, height, className }) => {
  const variant = teslaBodyVariant(model);
  const h = height ?? teslaIconHeight(model);
  const width = Math.round(h * (64 / 24));

  return (
    <svg
      viewBox="0 0 64 24"
      width={width}
      height={h}
      className={className}
      role="img"
      aria-label={model ? `Tesla ${model}` : 'Tesla'}
      fill="none"
    >
      <path d={BODY_PATHS[variant]} fill="currentColor" />
      <path d={WINDOW_PATHS[variant]} fill="#ffffff" fillOpacity={0.9} />
      <Wheel x={WHEEL_FRONT_X} />
      <Wheel x={WHEEL_REAR_X} />
    </svg>
  );
};

export default TeslaCarIcon;
