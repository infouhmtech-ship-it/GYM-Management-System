import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dataDir = path.resolve('data', 'mongo');

async function startEmbedded(persistent) {
  const instance = {
    ip: '127.0.0.1',
    launchTimeout: 120000,
  };
  if (persistent) {
    fs.mkdirSync(dataDir, { recursive: true });
    const lock = path.join(dataDir, 'mongod.lock');
    if (fs.existsSync(lock)) fs.rmSync(lock, { force: true });
    instance.dbPath = dataDir;
    instance.storageEngine = 'wiredTiger';
  }
  return MongoMemoryServer.create({ instance });
}

export async function connectDB() {
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database: external MongoDB');
    return;
  }

  let memory;
  try {
    memory = await startEmbedded(true);
    console.log('Database: embedded MongoDB (kept in server/data)');
  } catch (err) {
    console.warn(`Persistent database unavailable (${err.message}).`);
    console.warn('Starting a fresh in-memory database instead.');
    memory = await startEmbedded(false);
    console.log('Database: in-memory MongoDB (resets when the API stops)');
  }

  const uri = memory.getUri();
  await mongoose.connect(uri, { dbName: 'apex' });

  const stop = async () => {
    await mongoose.disconnect().catch(() => {});
    await memory.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
