// Другий варіант артикула Tesla: 161086600A <-> 1610866-00-A. Те саме — у backend services/part_numbers.py
const PLAIN = /^(\d{7})([A-Z0-9]{2})([A-Z])$/;
const HYPHEN = /^(\d{7})-([A-Z0-9]{2})-([A-Z])$/;

export const alternatePartNumber = (number: string): string | null => {
  const value = number.trim();
  let m = PLAIN.exec(value);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = HYPHEN.exec(value);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  return null;
};

export const splitPartNumbers = (value?: string | null): string[] => {
  if (!value || value.trim().toLowerCase() === 'null') return [];
  return value
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
};

// "161086600A / 1610866-00-A"
export const withAlternate = (number: string): string => {
  const alt = alternatePartNumber(number);
  return alt ? `${number} / ${alt}` : number;
};

export const displayPartNumbers = (value?: string | null): string =>
  splitPartNumbers(value).map(withAlternate).join(', ');

export const alternatePartNumbers = (...values: (string | null | undefined)[]): string[] => {
  const out: string[] = [];
  values.forEach((value) =>
    splitPartNumbers(value).forEach((n) => {
      const alt = alternatePartNumber(n);
      if (alt && !out.includes(alt)) out.push(alt);
    })
  );
  return out;
};

export const appendAlternates = (
  text: string,
  detailNumber?: string | null,
  crossNumber?: string | null
): string => {
  const alts = alternatePartNumbers(detailNumber, crossNumber);
  return alts.length ? `${text} ${alts.join(', ')}` : text;
};

// вставляємо після артикула на початку назви: усього поля або першого номера
export const insertAlternates = (title: string, detailNumber?: string | null): string => {
  const alts = alternatePartNumbers(detailNumber);
  if (!alts.length || !detailNumber) return title;
  const prefixes = [detailNumber.trim(), splitPartNumbers(detailNumber)[0]];
  const prefix = prefixes.find((p) => title.toLowerCase().startsWith(p.toLowerCase())) || '';
  if (prefix) return `${title.slice(0, prefix.length)} ${alts.join(' ')}${title.slice(prefix.length)}`;
  return `${title} ${alts.join(' ')}`;
};

// перший номер Tesla з поля у форматі з дефісами — для mpn у розмітці
export const hyphenatedPartNumber = (value?: string | null): string | null => {
  for (const n of splitPartNumbers(value)) {
    const alt = alternatePartNumber(n);
    if (alt) return alt.includes('-') ? alt : n;
  }
  return null;
};
