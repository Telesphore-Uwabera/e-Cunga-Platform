import mongoose from 'mongoose';

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}
