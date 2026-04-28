export function categoryFilterOptionLabel(category) {
  if (category === 'Pharmacy') return 'Medications';
  if (category === 'Laboratory') return 'Lab';
  return category;
}
