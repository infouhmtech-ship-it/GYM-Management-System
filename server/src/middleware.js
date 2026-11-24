import jwt from 'jsonwebtoken';
import { User } from './models.js';
import { asyncHandler } from './util.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ message: 'Sign in required.' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'apex-dev-secret-change-me');
    const user = await User.findById(payload.sub).select('-password');
    if (!user) {
      res.status(401).json({ message: 'Sign in required.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
});

export function allow(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have access to that.' });
      return;
    }
    next();
  };
}
