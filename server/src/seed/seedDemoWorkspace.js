/**
 * Idempotent seed: demo company (company_demo_1) + single admin user from env.
 * No sample inventory, requisitions, or other-role users — add those in production via invites.
 * Enable with SEED_DEMO_WORKSPACE=true or AUTO_SEED_DEMO_IF_EMPTY=true when MONGODB_URI is set.
 */
import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { getDemoPassword, getDemoUserDefinitions, getDemoWorkspaceCompanyName } from '../config/demoEnv.js';

const COMPANY_ID = 'company_demo_1';

export async function seedDemoWorkspace() {
  const demoCompanyName = getDemoWorkspaceCompanyName();

  await Company.updateOne(
    { _id: COMPANY_ID },
    {
      $set: {
        name: demoCompanyName,
        type: 'Healthcare / enterprise',
        industry: 'Healthcare',
        language: 'EN',
        currency: 'RWF',
        usersLimit: 10,
        registrationStatus: 'active',
        isPlatformTenant: true,
      },
    },
    { upsert: true }
  );

  const existingUsers = await User.countDocuments({ companyId: COMPANY_ID });
  if (existingUsers > 0) {
    console.log('[seed] Company users already present; skipping user injection.');
  } else {
    console.log('[seed] Creating admin user…');
    const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
    const demoDefs = getDemoUserDefinitions();

    await User.insertMany(
      demoDefs.map((d) => ({
        _id: d.id,
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
      }))
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
    '[seed] Workspace ready (admin only). Log in with DEMO_EMAIL_ADMIN and DEMO_PASSWORD from server/.env. Invite other roles from the admin portal.'
  );
}
