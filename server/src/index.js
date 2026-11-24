import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import { seedIfEmpty } from './seed.js';
import { requireAuth } from './middleware.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import leadRoutes from './routes/leads.js';
import { clubRouter, publicRouter } from './routes/club.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, club: 'APEX Athletic Club', city: 'Lahore' });
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRouter);
app.use('/api/members', requireAuth, memberRoutes);
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api', requireAuth, clubRouter);

app.use((err, _req, res, _next) => {
  if (err.name === 'CastError') {
    res.status(400).json({ message: 'That record does not exist.' });
    return;
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong on the club API.' : err.message,
  });
});

const port = Number(process.env.PORT || 4000);
await connectDB();
await seedIfEmpty();

const server = app.listen(port, () => {
  console.log(`APEX API http://localhost:${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    process.exit(1);
  }
  throw err;
});
