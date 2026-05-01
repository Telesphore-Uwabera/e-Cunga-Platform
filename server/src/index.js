import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 5000);

const { app, database } = await createApp();

app.listen(PORT, () => {
  console.log(`e-Cunga server listening on http://localhost:${PORT}`);
  console.log(database.reason);
});
 
