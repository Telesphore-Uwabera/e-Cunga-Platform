import TrustedPartner from '../models/TrustedPartner.js';
import cacheUtil from './cache.js';

/** Legacy homepage partners — inserted once when the collection is empty. */
const LEGACY_TRUSTED_PARTNERS = [
  {
    name: 'Labscroll Medicals',
    websiteUrl: 'http://www.labscrollmedicals.com/',
    logoUrl: '/Labscroll-Medicals-logo.webp',
    sortOrder: 0,
  },
  {
    name: 'Umucyo Clinic',
    websiteUrl: '',
    logoUrl: '/umucyo-clinic-logo.webp',
    sortOrder: 1,
  },
  {
    name: 'Goodlife',
    websiteUrl: 'https://ivuriro.rw/',
    logoUrl: '/goodlife-logo.webp',
    sortOrder: 2,
  },
];

/** Inserts legacy partners only when the collection has no documents yet. */
export async function seedLegacyTrustedPartnersIfEmpty() {
  const count = await TrustedPartner.countDocuments();
  if (count > 0) return false;

  await TrustedPartner.insertMany(
    LEGACY_TRUSTED_PARTNERS.map((row) => ({
      ...row,
      isActive: true,
      createdBy: 'system',
    }))
  );
  return true;
}

export function serializeTrustedPartner(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    websiteUrl: doc.websiteUrl || '',
    logoUrl: doc.logoUrl,
    sortOrder: doc.sortOrder ?? 0,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const TRUSTED_PARTNERS_PUBLIC_CACHE_KEY = '__express__/api/public/trusted-partners';

export function invalidateTrustedPartnersPublicCache() {
  cacheUtil.del(TRUSTED_PARTNERS_PUBLIC_CACHE_KEY);
}
