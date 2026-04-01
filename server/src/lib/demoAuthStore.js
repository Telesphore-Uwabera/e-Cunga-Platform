import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const DEMO_PASSWORD = 'Demo@1234';

const seedUsers = [
  {
    id: 'user_admin_1',
    fullName: 'Aline Uwimana',
    email: 'admin@ecunga.com',
    role: 'admin',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
  {
    id: 'user_clerk_1',
    fullName: 'Didier Nsengiyumva',
    email: 'clerk.one@ecunga.com',
    role: 'clerk',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
  {
    id: 'user_clerk_2',
    fullName: 'Josiane Mukamana',
    email: 'clerk.two@ecunga.com',
    role: 'clerk',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
  {
    id: 'user_supervisor_1',
    fullName: 'Patrick Ndagijimana',
    email: 'supervisor@ecunga.com',
    role: 'supervisor',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
  {
    id: 'user_accountant_1',
    fullName: 'Claudine Mukeshimana',
    email: 'accountant@ecunga.com',
    role: 'accountant',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
  {
    id: 'user_supplier_1',
    fullName: 'MediSupply Rwanda',
    email: 'supplier@ecunga.com',
    role: 'supplier',
    companyId: 'company_demo_1',
    companyName: 'e-CUNGA Demo Workspace',
    industry: 'Healthcare',
    isActive: true,
  },
];

let users = seedUsers.map((user) => ({
  ...user,
  passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
}));

let resetTokens = [];

function cloneUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getDemoPassword() {
  return DEMO_PASSWORD;
}

export function getUserById(id) {
  return cloneUser(users.find((user) => user.id === id));
}

export function findUserByEmail(email) {
  return users.find((user) => user.email === normalizeEmail(email));
}

export async function authenticateUser(email, password) {
  const user = findUserByEmail(email);
  if (!user || !user.isActive) return null;
  const matches = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!matches) return null;
  return cloneUser(user);
}

export async function createWorkspaceUser({ companyName, fullName, email, password, industry }) {
  const normalizedEmail = normalizeEmail(email);
  if (findUserByEmail(normalizedEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const id = crypto.randomUUID();
  const companyId = `company_${id}`;
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    industry: String(industry || 'Other').trim(),
    role: 'admin',
    isActive: true,
    passwordHash,
  };
  users = [...users, user];
  return cloneUser(user);
}

export function createPasswordReset(email) {
  const user = findUserByEmail(email);
  if (!user) {
    return { user: null, token: null };
  }

  const token = crypto.randomBytes(24).toString('hex');
  resetTokens = [
    ...resetTokens.filter((entry) => entry.userId !== user.id),
    {
      token,
      userId: user.id,
      expiresAt: Date.now() + 1000 * 60 * 30,
      used: false,
    },
  ];

  return { user: cloneUser(user), token };
}

export async function consumePasswordReset(token, nextPassword) {
  const resetEntry = resetTokens.find((entry) => entry.token === token);
  if (!resetEntry || resetEntry.used || resetEntry.expiresAt < Date.now()) {
    return null;
  }

  const userIndex = users.findIndex((user) => user.id === resetEntry.userId);
  if (userIndex === -1) return null;

  const passwordHash = await bcrypt.hash(String(nextPassword), 10);
  users[userIndex] = {
    ...users[userIndex],
    passwordHash,
  };

  resetTokens = resetTokens.map((entry) =>
    entry.token === token
      ? {
          ...entry,
          used: true,
        }
      : entry
  );

  return cloneUser(users[userIndex]);
}
