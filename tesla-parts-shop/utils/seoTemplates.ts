// Шаблони мета для категорій без власних meta_*. Ті самі — у backend services/seo_render.py
const SITE = 'Tesla Parts Center';
const KEEP_UPPER = new Set(['АВС']);

// H1 головної — той самий у backend services/seo_render.py (HOME_H1)
export const HOME_H1 = 'Запчастини для Tesla';

export const sentenceCase = (value: string) => {
  if (value !== value.toUpperCase()) return value;
  const text = value
    .toLowerCase()
    .split(' ')
    .map((word) => (KEEP_UPPER.has(word.toUpperCase()) ? word.toUpperCase() : word))
    .join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const isModel = (name: string) => /^model\s/i.test(name.trim());

export const categoryMeta = (name: string) =>
  isModel(name)
    ? {
        title: `Запчастини Tesla ${name} — купити з доставкою по Україні | ${SITE}`,
        description: `Запчастини для Tesla ${name}: нові деталі з номерами, ціни й наявність, підбір за схемами. Доставка по Україні.`,
      }
    : {
        title: `${name} для Tesla — купити з доставкою по Україні | ${SITE}`,
        description: `${name} для Tesla: нові товари, ціни й наявність. Доставка по Україні.`,
      };

export const subcategoryMeta = (name: string, categoryName: string) => {
  const sub = sentenceCase(name);
  if (!isModel(categoryName)) {
    return {
      title: `${sub} для Tesla | ${SITE}`,
      description: `${sub} для Tesla: нові товари, ціни й наявність. Доставка по Україні.`,
    };
  }
  return {
    title: `${sub} Tesla ${categoryName} — запчастини | ${SITE}`,
    description: `${sub} для Tesla ${categoryName}: нові запчастини з номерами деталей, ціни й наявність. Доставка по Україні.`,
  };
};
