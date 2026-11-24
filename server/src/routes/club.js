import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { CheckIn, ClassSession, Lead, Member, Payment, Plan, User } from '../models.js';
import { allow } from '../middleware.js';
import { dashboard } from './dashboard.js';
import { METHODS, PAYMENT_TYPES, ROLES, SOURCES } from '../constants.js';
import { nextInvoice } from '../sequences.js';
import {
  accessDecision,
  addDays,
  asyncHandler,
  digits,
  fullName,
  httpError,
  makeTempPassword,
  presentMember,
  startOfDay,
} from '../util.js';

export const clubRouter = Router();
export const publicRouter = Router();

const desk = ['owner', 'front_desk'];
const floor = ['owner', 'front_desk', 'trainer'];
const everyone = ['owner', 'front_desk', 'trainer', 'member'];

publicRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await Plan.find({ active: true, kind: 'membership' }).sort({ price: 1 });
    res.json({ plans });
  }),
);

publicRouter.post(
  '/enquiry',
  asyncHandler(async (req, res) => {
    const firstName = req.body.firstName?.trim();
    const lastName = req.body.lastName?.trim();
    const phone = req.body.phone?.trim();
    if (!firstName || !lastName) throw httpError(400, 'Add your first and last name.');
    if (!phone) throw httpError(400, 'Add a phone number the desk can reach.');
    if (!req.body.consent) throw httpError(400, 'Tick the box so the desk is allowed to call or WhatsApp you.');
    if (!SOURCES.includes(req.body.source)) throw httpError(400, 'Tell us how you heard about the club.');

    const phoneDigits = digits(phone);
    const openLead = await Lead.findOne({ phoneDigits, stage: { $nin: ['converted', 'lost'] } });
    if (openLead) {
      throw httpError(409, 'You are already on today’s call list. The desk has this number.');
    }
    const member = await Member.findOne({ phoneDigits, status: { $ne: 'cancelled' } });
    if (member) {
      throw httpError(409, 'This number is already on a membership. The desk can pull it up at the counter.');
    }

    const owner = (await User.findOne({ role: 'front_desk' }).sort({ createdAt: 1 }))
      || (await User.findOne({ role: 'owner' }));

    await Lead.create({
      firstName,
      lastName,
      phone,
      email: req.body.email?.trim().toLowerCase() || '',
      source: req.body.source,
      goal: req.body.goal?.trim() || '',
      preferredTime: req.body.preferredTime?.trim() || '',
      referredBy: req.body.referredBy?.trim() || '',
      stage: 'new',
      owner: owner?._id,
      consent: true,
      nextAction: 'Call within the hour',
      nextActionDate: new Date(),
      activities: [
        {
          kind: 'created',
          text: 'Sent from the public enquiry form.',
          authorName: 'Website',
          at: new Date(),
        },
      ],
    });

    res.status(201).json({
      message: 'You are on the list. The desk calls new enquiries the same day.',
    });
  }),
);

clubRouter.get('/dashboard', allow(...floor), dashboard);

clubRouter.get(
  '/plans',
  allow(...floor),
  asyncHandler(async (_req, res) => {
    const plans = await Plan.find().sort({ kind: 1, price: 1 });
    res.json({ plans });
  }),
);

clubRouter.post(
  '/plans',
  allow('owner'),
  asyncHandler(async (req, res) => {
    const name = req.body.name?.trim();
    const price = Number(req.body.price);
    const durationDays = Number(req.body.durationDays);
    if (!name || Number.isNaN(price) || price < 0 || !durationDays) {
      throw httpError(400, 'Name, price, and length are required.');
    }
    const plan = await Plan.create({
      name,
      price,
      durationDays,
      cycle: req.body.cycle || 'month',
      kind: 'membership',
      access: req.body.access || 'full',
      description: req.body.description?.trim() || '',
      perks: Array.isArray(req.body.perks) ? req.body.perks.filter(Boolean) : [],
      active: true,
      trial: Boolean(req.body.trial),
    });
    res.status(201).json({ plan });
  }),
);

clubRouter.patch(
  '/plans/:id',
  allow('owner'),
  asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) throw httpError(404, 'Plan not found.');
    for (const field of ['name', 'description', 'active', 'featured']) {
      if (req.body[field] !== undefined) plan[field] = req.body[field];
    }
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (Number.isNaN(price) || price < 0) throw httpError(400, 'Price has to be zero or more.');
      plan.price = price;
    }
    await plan.save();
    res.json({ plan });
  }),
);

clubRouter.get(
  '/payments',
  allow(...desk),
  asyncHandler(async (_req, res) => {
    const payments = await Payment.find().sort({ createdAt: -1 }).limit(200);
    res.json({ payments });
  }),
);

clubRouter.post(
  '/payments',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.body.memberId);
    if (!member) throw httpError(404, 'Member not found.');
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) throw httpError(400, 'Enter an amount.');
    if (!PAYMENT_TYPES.includes(req.body.type)) throw httpError(400, 'Choose what the payment is for.');
    const status = req.body.status || 'paid';
    if (!['paid', 'pending', 'failed'].includes(status)) throw httpError(400, 'Unknown payment status.');
    if (status === 'paid' && !METHODS.includes(req.body.method)) throw httpError(400, 'Choose how they paid.');

    const payment = await Payment.create({
      invoiceNo: await nextInvoice(),
      member: member._id,
      memberName: fullName(member),
      amount,
      method: req.body.method || 'cash',
      status,
      type: req.body.type,
      description: req.body.description?.trim() || req.body.type,
      paidAt: status === 'paid' ? new Date() : null,
      dueDate: req.body.dueDate || new Date(),
      recordedBy: req.user.name,
    });
    res.status(201).json({ payment });
  }),
);

clubRouter.post(
  '/checkins/lookup',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const q = String(req.body.query || '').trim().toLowerCase();
    if (q.length < 2) throw httpError(400, 'Type a name, phone, or member code.');
    const parts = q.split(/\s+/);
    const members = await Member.find().populate('plan');
    const matches = members
      .filter((member) => {
        const hay = `${member.firstName} ${member.lastName} ${member.phone} ${member.phoneDigits} ${member.code}`.toLowerCase();
        return parts.every((part) => hay.includes(part));
      })
      .slice(0, 8)
      .map((member) => ({
        member: presentMember(member),
        decision: accessDecision(member, member.plan),
      }));
    res.json({ matches });
  }),
);

clubRouter.post(
  '/checkins',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.body.memberId).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    const decision = accessDecision(member, member.plan);
    const checkin = await CheckIn.create({
      member: member._id,
      memberName: fullName(member),
      memberCode: member.code,
      at: new Date(),
      result: decision.allowed ? 'allowed' : 'denied',
      reason: decision.reason,
      byName: req.user.name,
    });
    res.status(201).json({ checkin, member: presentMember(member), decision });
  }),
);

clubRouter.get(
  '/checkins',
  allow(...desk),
  asyncHandler(async (_req, res) => {
    const checkins = await CheckIn.find({ at: { $gte: startOfDay() } }).sort({ at: -1 }).limit(40);
    res.json({ checkins });
  }),
);

clubRouter.get(
  '/classes',
  allow(...everyone),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(req.query.from) : addDays(startOfDay(), -1);
    const to = req.query.to ? new Date(req.query.to) : addDays(startOfDay(), 8);
    const classes = await ClassSession.find({ startsAt: { $gte: from, $lt: to } }).sort({ startsAt: 1 });
    res.json({ classes });
  }),
);

clubRouter.post(
  '/classes',
  allow(...floor),
  asyncHandler(async (req, res) => {
    const title = req.body.title?.trim();
    const startsAt = new Date(req.body.startsAt);
    const duration = Number(req.body.duration || 60);
    if (!title || Number.isNaN(startsAt.getTime())) throw httpError(400, 'Title and start time are required.');
    let trainerName = req.user.name;
    let trainerId = req.user._id;
    if (req.body.trainerId) {
      const trainer = await User.findById(req.body.trainerId);
      if (!trainer) throw httpError(400, 'Choose a coach who is on the team.');
      trainerName = trainer.name;
      trainerId = trainer._id;
    }
    const session = await ClassSession.create({
      title,
      category: req.body.category?.trim() || 'Class',
      trainer: trainerId,
      trainerName,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration * 60000),
      capacity: Number(req.body.capacity || 12),
      room: req.body.room?.trim() || 'Studio A',
      bookings: [],
    });
    res.status(201).json({ class: session });
  }),
);

async function bookMember(session, memberId) {
  const member = await Member.findById(memberId).populate('plan');
  if (!member) throw httpError(404, 'Member not found.');
  const decision = accessDecision(member, member.plan, new Date(session.startsAt));
  if (!decision.allowed) throw httpError(400, decision.reason);
  const live = session.bookings.filter((booking) => booking.status !== 'cancelled');
  if (live.some((booking) => String(booking.member) === String(member._id))) {
    throw httpError(400, 'Already booked on this class.');
  }
  if (live.length >= session.capacity) throw httpError(400, 'That class is full.');
  session.bookings.push({
    member: member._id,
    memberName: fullName(member),
    memberCode: member.code,
    status: 'booked',
  });
  await session.save();
  return session;
}

clubRouter.post(
  '/classes/:id/book',
  allow(...everyone),
  asyncHandler(async (req, res) => {
    const session = await ClassSession.findById(req.params.id);
    if (!session) throw httpError(404, 'Class not found.');
    const memberId = req.user.role === 'member' ? req.user.member : req.body.memberId;
    if (!memberId) throw httpError(400, 'Choose a member.');
    res.json({ class: await bookMember(session, memberId) });
  }),
);

clubRouter.post(
  '/classes/:id/cancel',
  allow(...everyone),
  asyncHandler(async (req, res) => {
    const session = await ClassSession.findById(req.params.id);
    if (!session) throw httpError(404, 'Class not found.');
    const memberId = req.user.role === 'member' ? req.user.member : req.body.memberId;
    const booking = session.bookings.find((item) => String(item.member) === String(memberId));
    if (!booking) throw httpError(404, 'That booking is not on the class.');
    if (booking.status !== 'booked') throw httpError(400, 'Only an open booking can be cancelled.');
    booking.status = 'cancelled';
    await session.save();
    res.json({ class: session });
  }),
);

clubRouter.post(
  '/classes/:id/attendance',
  allow(...floor),
  asyncHandler(async (req, res) => {
    const session = await ClassSession.findById(req.params.id);
    if (!session) throw httpError(404, 'Class not found.');
    if (!['attended', 'no_show', 'booked'].includes(req.body.status)) {
      throw httpError(400, 'Unknown attendance mark.');
    }
    const booking = session.bookings.find(
      (item) => String(item.member) === String(req.body.memberId) && item.status !== 'cancelled',
    );
    if (!booking) throw httpError(404, 'That member is not booked.');
    booking.status = req.body.status;
    await session.save();
    res.json({ class: session });
  }),
);

clubRouter.get(
  '/portal',
  allow('member'),
  asyncHandler(async (req, res) => {
    if (!req.user.member) throw httpError(400, 'No membership is linked to this login.');
    const member = await Member.findById(req.user.member).populate('plan');
    if (!member) throw httpError(404, 'Membership not found.');
    const [payments, checkins, classes] = await Promise.all([
      Payment.find({ member: member._id }).sort({ createdAt: -1 }).limit(8),
      CheckIn.find({ member: member._id }).sort({ at: -1 }).limit(10),
      ClassSession.find({ 'bookings.member': member._id, startsAt: { $gte: addDays(startOfDay(), -1) } }).sort({ startsAt: 1 }),
    ]);
    res.json({
      member: presentMember(member),
      payments,
      checkins,
      classes: classes.map((session) => ({
        _id: session._id,
        title: session.title,
        category: session.category,
        trainerName: session.trainerName,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        room: session.room,
        status: session.bookings.find((item) => String(item.member) === String(member._id))?.status,
      })),
    });
  }),
);

clubRouter.get(
  '/staff',
  allow(...floor),
  asyncHandler(async (_req, res) => {
    const staff = await User.find({ role: { $ne: 'member' } }).select('-password').sort({ name: 1 });
    res.json({
      staff: staff.map((person) => ({
        id: person._id,
        name: person.name,
        email: person.email,
        role: person.role,
        phone: person.phone,
        title: person.title,
      })),
    });
  }),
);

clubRouter.post(
  '/staff',
  allow('owner'),
  asyncHandler(async (req, res) => {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const role = req.body.role;
    if (!name || !email) throw httpError(400, 'Name and email are required.');
    if (!ROLES.includes(role) || role === 'member') throw httpError(400, 'Choose owner, front desk, or coach.');
    if (await User.findOne({ email })) throw httpError(409, 'That email already has a login.');
    const tempPassword = makeTempPassword();
    const person = await User.create({
      name,
      email,
      password: await bcrypt.hash(tempPassword, 10),
      role,
      phone: req.body.phone?.trim() || '',
      title: req.body.title?.trim() || '',
    });
    res.status(201).json({
      staff: { id: person._id, name: person.name, email: person.email, role: person.role, phone: person.phone, title: person.title },
      tempPassword,
    });
  }),
);
