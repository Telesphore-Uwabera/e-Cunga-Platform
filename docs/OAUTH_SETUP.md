# OAuth Authentication Setup

This guide explains how to set up Google and Microsoft OAuth authentication for the e-Cunga Portal.

## Google OAuth Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable Google+ API and Google OAuth2 API

2. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback` (for development)
   - For production, use: `https://your-domain.com/api/auth/google/callback`
   - Copy the Client ID and Client Secret

## Microsoft OAuth Setup

1. **Register App in Azure AD**
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory > App registrations
   - Click "New registration"
   - Give your app a name (e.g., "e-Cunga Portal")
   - Select "Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts"
   - Set the redirect URI: `http://localhost:5000/api/auth/microsoft/callback` (for development)
   - For production, use: `https://your-domain.com/api/auth/microsoft/callback`

2. **Create Client Secret**
   - Go to Certificates & secrets
   - Click "New client secret"
   - Add a description and choose an expiration period
   - Copy the client secret immediately (it won't be shown again)

## Environment Configuration

Add the following to your `server/.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
```

## Important Notes

- **Existing Users**: OAuth login only works for existing accounts. Users must first register with email/password before using OAuth.
- **Email Matching**: The email from OAuth provider must match an existing user's email in the system.
- **Development**: For local development, you may need to add `http://localhost:5173` to the authorized origins in your OAuth app settings.
- **HTTPS**: OAuth providers require HTTPS in production. Use SSL certificates for your domain.

## Testing

1. Start the server: `npm run dev:server`
2. Navigate to the login page
3. Click "Sign in with Google" or "Sign in with Microsoft"
4. Complete the OAuth flow in the provider's popup
5. You should be redirected back to the application and logged in

## Troubleshooting

- **"OAuth is not configured"**: Make sure the environment variables are set correctly
- **"Invalid state parameter"**: Clear your cookies and try again
- **"No account found"**: Register an account with the same email first using email/password
- **Redirect errors**: Check that your redirect URIs match exactly in both the OAuth provider settings and your environment
