# e-Cunga Portal Setup Guide

This guide covers the complete setup for the e-Cunga Portal, including authentication, registration, and supplier management.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

## Environment Configuration

### Required Variables
```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-secret-key
MONGODB_URI=your-mongodb-connection-string
```

### Optional Variables
```env
# Email configuration
SMTP_URL=smtps://user:pass@smtp.example.com:465

# Cloud storage (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# AI insights
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

# OAuth providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

## Registration System

The e-Cunga Portal now supports **unified registration** where users can choose their account type:

### Account Types

1. **Supervisor** - Healthcare facilities and organizations
   - Requires admin approval
   - Can manage teams, approve requisitions
   - Full access to procurement features

2. **Supplier** - Independent suppliers and vendors
   - Immediate activation (no approval needed)
   - Can manage product catalog
   - Respond to procurement requests

### Registration Flow

1. Navigate to `/register`
2. Choose account type (Supervisor or Supplier)
3. Fill in company and personal details
4. Create password
5. Submit registration

**Supervisor accounts** will require admin approval before activation.
**Supplier accounts** are activated immediately.

## OAuth Authentication Setup

### Google OAuth

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google+ API and Google OAuth2 API

2. **Create OAuth Credentials**
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Select "Web application"
   - Add redirect URI: `http://localhost:5000/api/auth/google/callback`
   - Copy Client ID and Client Secret

### Microsoft OAuth

1. **Register App in Azure AD**
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory > App registrations
   - Click "New registration"
   - Select "Accounts in any organizational directory"
   - Set redirect URI: `http://localhost:5000/api/auth/microsoft/callback`

2. **Create Client Secret**
   - Go to Certificates & secrets
   - Click "New client secret"
   - Copy the client secret immediately

## Supplier Management

### For Supervisors

Supervisors can browse and connect with suppliers through the supplier directory:

1. Navigate to **Suppliers** tab in dashboard
2. Browse available suppliers
3. Filter by industry, location, or search
4. View supplier catalogs
5. Connect with preferred suppliers

### For Suppliers

Suppliers can manage their business independently:

1. Register as a supplier (immediate activation)
2. Add products to catalog
3. Respond to procurement requests
4. Manage invoices and deliveries
5. Track payments

## Database Setup

### MongoDB Schema

The system uses MongoDB with the following key collections:

- **Users** - User accounts and authentication
- **Companies** - Organization information
- **SupplierCatalogItem** - Supplier product catalogs
- **Requisitions** - Procurement requests
- **Invoices** - Billing and payments

### Demo Data

To populate demo data:
```env
SEED_DEMO_WORKSPACE=true
AUTO_SEED_DEMO_IF_EMPTY=true
```

## File Upload Configuration

For file uploads (documents, images), configure Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Email Configuration

For transactional emails (registration confirmations, notifications):

```env
SMTP_URL=smtps://user:pass@smtp.example.com:465
# Or individual settings
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
MAIL_FROM="e-Cunga Portal <noreply@yourdomain.com>"
```

## Development Tips

### Testing OAuth Locally
- Use `http://localhost:5173` as authorized origin
- Set redirect URIs to match your local setup
- Test with real Google/Microsoft accounts

### Supplier Registration Testing
1. Register a test supplier account
2. Add products to catalog
3. Test as supervisor browsing suppliers
4. Test connection workflow

### Common Issues
- **Port conflicts**: Ensure port 5000 is free
- **MongoDB connection**: Check connection string format
- **OAuth errors**: Verify redirect URIs match exactly
- **Email issues**: Test SMTP settings separately

## Production Deployment

### Security Checklist
- [ ] Change JWT_SECRET from default
- [ ] Use HTTPS for all endpoints
- [ ] Configure proper CORS settings
- [ ] Set up monitoring and logging
- [ ] Enable database backups
- [ ] Review OAuth app permissions

### Environment Variables
```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-domain.com
API_URL=https://api.your-domain.com
```

## Support

For issues and questions:
1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure MongoDB is accessible
4. Test OAuth configuration separately
5. Review this documentation for common solutions

## Features Summary

- **Unified Registration** - Choose Supervisor or Supplier role
- **OAuth Authentication** - Google and Microsoft sign-in
- **Supplier Directory** - Browse and connect with suppliers
- **Independent Suppliers** - Self-service registration and management
- **Procurement Workflow** - Complete requisition-to-payment process
- **Real-time Notifications** - Email and in-app alerts
- **File Management** - Document uploads and storage
- **Multi-language Support** - English and Kinyarwanda
- **Role-based Access** - Granular permissions and controls
