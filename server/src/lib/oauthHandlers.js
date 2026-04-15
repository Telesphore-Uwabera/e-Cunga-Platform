import axios from 'axios';
import { signAuthToken } from './authToken.js';
import { isDatabaseReady } from './db.js';
import { authenticateMongoUser, createMongoWorkspaceUser, toAuthUser } from './mongoAuth.js';
import { authenticateUser, createWorkspaceUser } from './demoAuthStore.js';
import { getOAuthConfig } from '../config/oauth.js';

export async function handleGoogleCallback(code, state) {
  const config = getOAuthConfig();
  
  // Exchange code for tokens
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: config.google.clientID,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.callbackURL,
    grant_type: 'authorization_code',
  });

  const { access_token } = tokenResponse.data;

  // Get user profile
  const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const profile = userResponse.data;
  return await processOAuthProfile('google', profile);
}

export async function handleMicrosoftCallback(code, state) {
  const config = getOAuthConfig();
  
  // Exchange code for tokens
  const tokenResponse = await axios.post(config.microsoft.tokenURL, {
    code,
    client_id: config.microsoft.clientID,
    client_secret: config.microsoft.clientSecret,
    redirect_uri: config.microsoft.callbackURL,
    grant_type: 'authorization_code',
  });

  const { access_token } = tokenResponse.data;

  // Get user profile
  const userResponse = await axios.get(config.microsoft.userInfoURL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const profile = userResponse.data;
  return await processOAuthProfile('microsoft', profile);
}

async function processOAuthProfile(provider, profile) {
  // Normalize profile data
  const email = profile.email;
  const fullName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();
  
  if (!email) {
    throw new Error('Email is required from OAuth provider');
  }

  if (isDatabaseReady()) {
    return await handleMongoOAuth(email, fullName, provider);
  } else {
    return await handleDemoOAuth(email, fullName, provider);
  }
}

async function handleMongoOAuth(email, fullName, provider) {
  // Check if user exists
  const User = (await import('../models/User.js')).default;
  let user = await User.findOne({ email: email.toLowerCase().trim() });

  if (user) {
    // Existing user - check if active
    if (!user.isActive) {
      throw new Error('Your account is not active. Please contact support.');
    }
    
    // Update OAuth info if needed
    if (!user.oauthProviders) user.oauthProviders = [];
    if (!user.oauthProviders.includes(provider)) {
      user.oauthProviders.push(provider);
      await user.save();
    }
  } else {
    // New user - create account (this could be enhanced to show a registration form)
    throw new Error('No account found with this email. Please register first using email and password.');
  }

  const authUser = toAuthUser(user);
  const token = signAuthToken({
    id: authUser.id,
    role: authUser.role,
    companyId: authUser.companyId,
    email: authUser.email,
  });

  return { user: authUser, token };
}

async function handleDemoOAuth(email, fullName, provider) {
  // Check if user exists in demo
  const existingUser = authenticateUser(email);
  
  if (!existingUser) {
    throw new Error('No account found with this email. Please register first using email and password.');
  }

  if (!existingUser.isActive) {
    throw new Error('Your account is not active. Please contact support.');
  }

  // Update OAuth info
  if (!existingUser.oauthProviders) existingUser.oauthProviders = [];
  if (!existingUser.oauthProviders.includes(provider)) {
    existingUser.oauthProviders.push(provider);
  }

  const token = signAuthToken({
    id: existingUser.id,
    role: existingUser.role,
    companyId: existingUser.companyId,
    email: existingUser.email,
  });

  return { user: existingUser, token };
}
