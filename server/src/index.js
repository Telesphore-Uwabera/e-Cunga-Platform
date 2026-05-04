import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 10000);

const { app, database } = await createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`e-Cunga server listening on port ${PORT}`);
  console.log(database.reason);
});
 
