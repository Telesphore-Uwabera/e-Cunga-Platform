import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 5000);

const { app, database } = await createApp();

app.listen(PORT, () => {
  console.log(`e-CUNGA server listening on http://localhost:${PORT}`);
  console.log(database.reason);
  console.log('Demo accounts: configure DEMO_PASSWORD and DEMO_EMAIL_* in server/.env — GET /api/auth/demo-credentials');
});
