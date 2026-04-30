import { ECOSYSTEM_CATEGORY_SECTOR, isEcosystemCategoryId } from '../constants/ecosystemCatalog.js';

export function categoryFilterOptionLabel(category) {
  if (isEcosystemCategoryId(category)) {
    return ECOSYSTEM_CATEGORY_SECTOR[category] || category;
  }
  if (category === 'Pharmacy') return 'Medications';
  if (category === 'Laboratory') return 'Lab';
  return category;
}
