import crypto from 'node:crypto';

export function getOAuthConfig() {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  
  return {
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      scope: ['profile', 'email'],
    },
    microsoft: {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/microsoft/callback`,
      scope: ['openid', 'profile', 'email'],
      authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoURL: 'https://graph.microsoft.com/v1.0/me',
    },
  };
}

export function generateOAuthState() {
  return crypto.randomBytes(32).toString('hex');
}

export function isOAuthConfigured(provider) {
  const config = getOAuthConfig();
  return config[provider]?.clientID && config[provider]?.clientSecret;
}
