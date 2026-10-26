import { SavedCar } from '../types';
import { slugify } from '../utils/slugify';

// Helper for precise Tesla model & submodel matching
export const getCarTargetInfo = (car: SavedCar) => {
  const model = car.model || '';
  const gen = car.generation || '';
  const year = car.year || 0;

  const isHighland =
    model.toLowerCase().includes('highland') ||
    gen.toLowerCase().includes('highland') ||
    (model === 'Model 3' && year >= 2024);

  const isJuniper =
    model.toLowerCase().includes('juniper') ||
    gen.toLowerCase().includes('juniper') ||
    (model === 'Model Y' && year >= 2025);

  if (isHighland) {
    return {
      displayName: 'Model 3 Highland',
      fullTitle: 'Tesla Model 3 Highland',
      categorySlug: 'model-3-highland',
      schematicModel: 'Model 3 Highland',
      schematicGen: 'Highland (2024-...)',
      schemesUrl: '/schemes?model=Model%203%20Highland&generation=Highland%20(2024-...)',
    };
  }

  if (isJuniper) {
    return {
      displayName: 'Model Y Juniper',
      fullTitle: 'Tesla Model Y Juniper',
      categorySlug: 'model-y-juniper',
      schematicModel: 'Model Y Juniper',
      schematicGen: 'Juniper (2025-...)',
      schemesUrl: '/schemes?model=Model%20Y%20Juniper&generation=Juniper%20(2025-...)',
    };
  }

  const slug = slugify(model);
  const genParam = gen && !gen.includes('Стандартн') ? `&generation=${encodeURIComponent(gen)}` : '';
  return {
    displayName: model,
    fullTitle: `Tesla ${model}`,
    categorySlug: slug,
    schematicModel: model,
    schematicGen: gen,
    schemesUrl: `/schemes?model=${encodeURIComponent(model)}${genParam}`,
  };
};
