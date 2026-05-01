/**
 * Idempotent seed: demo company (company_demo_1) + single admin user from env.
 * No sample inventory, requisitions, or other-role users — add those in production via invites.
 * Enable with SEED_DEMO_WORKSPACE=true or AUTO_SEED_DEMO_IF_EMPTY=true when MONGODB_URI is set.
 */
import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import {
  getDemoLogoUrl,
  getDemoPassword,
  getDemoUserDefinitions,
  getDemoWorkspaceCompanyName,
} from '../config/demoEnv.js';

const COMPANY_ID = 'company_demo_1';

export async function seedDemoWorkspace() {
  const demoCompanyName = getDemoWorkspaceCompanyName();
  const logoUrl = getDemoLogoUrl();

  await Company.updateOne(
    { _id: COMPANY_ID },
    {
      $set: {
        name: demoCompanyName,
        type: '',
        industry: '',
        language: 'EN',
        currency: 'RWF',
        usersLimit: 10,
        registrationStatus: 'active',
        isPlatformTenant: true,
        logoUrl,
      },
    },
    { upsert: true }
  );

  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
  const demoDefs = getDemoUserDefinitions();

  for (const d of demoDefs) {
    await User.updateOne(
      { _id: d.id },
      {
        $set: {
          incrementalId: d.incrementalId,
          companyId: d.companyId,
          companyName: d.companyName,
          fullName: d.fullName,
          email: d.email,
          passwordHash,
          role: d.role,
          industry: d.industry,
          team: d.team,
          location: d.location,
          isActive: d.isActive,
          phone: d.phone ?? '',
          jobTitle: d.jobTitle ?? '',
          timeZone: d.timeZone ?? 'Africa/Kigali',
          notifyEmailDigest: d.notifyEmailDigest !== false,
          notifySecurityAlerts: d.notifySecurityAlerts !== false,
          notifyProductUpdates: Boolean(d.notifyProductUpdates),
          logoUrl: d.logoUrl || logoUrl,
          invitePending: false,
        },
      },
      { upsert: true }
    );
  }

  {
    const top = await User.findOne({ incrementalId: { $exists: true, $ne: null } })
      .sort({ incrementalId: -1 })
      .select('incrementalId')
      .lean();
    const seq = top?.incrementalId ?? 0;
    if (seq > 0) {
      await Counter.findByIdAndUpdate('user', { $max: { seq } }, { upsert: true, new: true });
    }
  }

  console.log(
    '[seed] Workspace ready (admin). Log in with DEMO_EMAIL_ADMIN and DEMO_PASSWORD. Logo: ' + (logoUrl || '(set CLIENT_URL or DEMO_LOGO_URL)')
  );
}
