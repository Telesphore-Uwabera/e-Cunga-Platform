import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 5001);

const { app, database } = await createApp();

app.listen(PORT, () => {
  console.log(`e-CUNGA server listening on http://localhost:${PORT}`);
  console.log(database.reason);
  console.log('Demo accounts are available with password: Demo@1234');
});
