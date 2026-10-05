import TrustedPartner from '../models/TrustedPartner.js';

/** Static home-page logos — seeded once when the collection is empty. */
export const DEFAULT_TRUSTED_PARTNERS = [
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

export async function ensureDefaultTrustedPartners() {
  const count = await TrustedPartner.countDocuments();
  if (count > 0) return false;

  await TrustedPartner.insertMany(
    DEFAULT_TRUSTED_PARTNERS.map((row) => ({
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
