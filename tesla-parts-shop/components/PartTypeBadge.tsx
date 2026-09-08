import React from 'react';
import { ShieldCheck, Layers } from 'lucide-react';
import { PartType } from '../utils/partType';

interface PartTypeBadgeProps {
  type: PartType;
  variant?: 'floating' | 'pill' | 'subtle';
  size?: 'sm' | 'md';
  className?: string;
}

export const PartTypeBadge: React.FC<PartTypeBadgeProps> = ({
  type,
  variant = 'floating',
  size = 'sm',
  className = '',
}) => {
  if (!type) return null;

  const isOriginal = type === 'original';

  if (variant === 'floating') {
    return isOriginal ? (
      <span
        className={`inline-flex items-center gap-1 bg-blue-600/90 text-white backdrop-blur-xs font-bold rounded-full shadow-xs border border-blue-400/30 select-none ${
          size === 'md'
            ? 'text-xs px-2.5 py-0.5'
            : 'text-[10px] px-2 py-0.5'
        } ${className}`}
        title="Оригінальна деталь Tesla"
      >
        <ShieldCheck size={size === 'md' ? 12 : 10.5} className="text-blue-100 flex-shrink-0" />
        <span>Оригінал</span>
      </span>
    ) : (
      <span
        className={`inline-flex items-center gap-1 bg-amber-500/95 text-neutral-900 backdrop-blur-xs font-bold rounded-full shadow-xs border border-amber-300/40 select-none ${
          size === 'md'
            ? 'text-xs px-2.5 py-0.5'
            : 'text-[10px] px-2 py-0.5'
        } ${className}`}
        title="Аналог високої якості"
      >
        <Layers size={size === 'md' ? 12 : 10.5} className="text-neutral-800 flex-shrink-0" />
        <span>Аналог</span>
      </span>
    );
  }

  if (variant === 'pill') {
    return isOriginal ? (
      <span
        className={`inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200/80 text-blue-700 font-bold rounded-full shadow-2xs tracking-wide select-none ${
          size === 'md'
            ? 'text-xs px-3 py-1'
            : 'text-[11px] px-2.5 py-0.5'
        } ${className}`}
        title="Оригінальна деталь Tesla"
      >
        <ShieldCheck size={size === 'md' ? 13 : 12} className="text-blue-600 flex-shrink-0" />
        <span>Оригінал</span>
      </span>
    ) : (
      <span
        className={`inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 text-amber-800 font-bold rounded-full shadow-2xs tracking-wide select-none ${
          size === 'md'
            ? 'text-xs px-3 py-1'
            : 'text-[11px] px-2.5 py-0.5'
        } ${className}`}
        title="Аналог високої якості"
      >
        <Layers size={size === 'md' ? 13 : 12} className="text-amber-600 flex-shrink-0" />
        <span>Аналог</span>
      </span>
    );
  }

  // Subtle variant (e.g. for cart or lists)
  return isOriginal ? (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded select-none ${className}`}
    >
      <ShieldCheck size={10} className="text-blue-600 flex-shrink-0" />
      <span>Оригінал</span>
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded select-none ${className}`}
    >
      <Layers size={10} className="text-amber-600 flex-shrink-0" />
      <span>Аналог</span>
    </span>
  );
};

export default PartTypeBadge;
