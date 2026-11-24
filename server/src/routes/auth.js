import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { requireAuth } from '../middleware.js';
import { asyncHandler, httpError, publicUser } from '../util.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw httpError(401, 'Those details do not match a club login.');
    }
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET || 'apex-dev-secret-change-me',
      { expiresIn: '12h' },
    );
    res.json({ token, user: publicUser(user) });
  }),
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
