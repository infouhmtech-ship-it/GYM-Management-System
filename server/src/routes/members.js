import { Router } from 'express';
import { CheckIn, ClassSession, Member, Payment, Plan } from '../models.js';
import { allow } from '../middleware.js';
import { enrollMember } from '../enroll.js';
import { METHODS, SOURCES } from '../constants.js';
import { nextInvoice } from '../sequences.js';
import {
  addDays,
  asyncHandler,
  daysBetween,
  effectiveStatus,
  fullName,
  httpError,
  membershipEnd,
  presentMember,
  startOfDay,
} from '../util.js';

const router = Router();
const staff = ['owner', 'front_desk', 'trainer'];
const desk = ['owner', 'front_desk'];

router.get(
  '/',
  allow(...staff),
  asyncHandler(async (req, res) => {
    const members = await Member.find().populate('plan').sort({ firstName: 1, lastName: 1 });
    const ids = members.map((m) => m._id);
    const lasts = await CheckIn.aggregate([
      { $match: { member: { $in: ids }, result: 'allowed' } },
      { $sort: { at: -1 } },
      { $group: { _id: '$member', at: { $first: '$at' } } },
    ]);
    const lastMap = new Map(lasts.map((row) => [String(row._id), row.at]));
    const q = String(req.query.q || '').trim().toLowerCase();
    const parts = q ? q.split(/\s+/) : [];
    let rows = members.map((member) => ({
      ...presentMember(member),
      lastVisit: lastMap.get(String(member._id)) || null,
    }));
    if (parts.length) {
      rows = rows.filter((member) => {
        const hay = [
          member.firstName,
          member.lastName,
          member.phone,
          member.phoneDigits,
          member.code,
          member.email,
        ]
          .join(' ')
          .toLowerCase();
        return parts.every((part) => hay.includes(part));
      });
    }
    if (req.query.status) rows = rows.filter((member) => member.effectiveStatus === req.query.status);
    if (req.query.source) rows = rows.filter((member) => member.source === req.query.source);
    res.json({ members: rows });
  }),
);

router.post(
  '/',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const result = await enrollMember({ ...req.body, actor: req.user });
    res.status(201).json(result);
  }),
);

router.get(
  '/:id',
  allow(...staff),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    const [payments, checkins, classes] = await Promise.all([
      Payment.find({ member: member._id }).sort({ createdAt: -1 }).limit(40),
      CheckIn.find({ member: member._id }).sort({ at: -1 }).limit(30),
      ClassSession.find({ 'bookings.member': member._id }).sort({ startsAt: -1 }).limit(20),
    ]);
    const money = desk.includes(req.user.role);
    const sessions = classes.map((session) => {
      const booking = session.bookings.find((item) => String(item.member) === String(member._id));
      return {
        _id: session._id,
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        room: session.room,
        trainerName: session.trainerName,
        status: booking?.status || 'booked',
      };
    });
    res.json({
      member: presentMember(member),
      payments: money ? payments : [],
      checkins,
      sessions,
      canBill: money,
    });
  }),
);

router.patch(
  '/:id',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id);
    if (!member) throw httpError(404, 'Member not found.');
    const fields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'gender',
      'emergencyName',
      'emergencyPhone',
      'goal',
      'healthNotes',
      'waiverSigned',
      'source',
      'referredBy',
      'dateOfBirth',
      'plan',
      'endDate',
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) member[field] = req.body[field];
    }
    if (member.source && !SOURCES.includes(member.source)) throw httpError(400, 'Unknown source.');
    if (!member.firstName?.trim() || !member.lastName?.trim()) {
      throw httpError(400, 'Name cannot be empty.');
    }
    await member.save();
    const populated = await Member.findById(member._id).populate('plan');
    res.json({ member: presentMember(populated) });
  }),
);

router.post(
  '/:id/notes',
  allow(...staff),
  asyncHandler(async (req, res) => {
    const text = String(req.body.text || '').trim();
    if (!text) throw httpError(400, 'Write the note first.');
    const member = await Member.findById(req.params.id);
    if (!member) throw httpError(404, 'Member not found.');
    member.notes.push({ text, authorName: req.user.name, at: new Date() });
    await member.save();
    const populated = await Member.findById(member._id).populate('plan');
    res.json({ member: presentMember(populated) });
  }),
);

router.post(
  '/:id/freeze',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    const status = effectiveStatus(member);
    if (status === 'cancelled') throw httpError(400, 'A cancelled membership cannot be frozen.');
    if (status === 'frozen') throw httpError(400, 'This membership is already frozen.');
    if (!req.body.until) throw httpError(400, 'Choose the date the freeze ends.');
    const until = new Date(req.body.until);
    if (Number.isNaN(until.getTime()) || startOfDay(until) < startOfDay()) {
      throw httpError(400, 'Freeze end date has to be today or later.');
    }
    until.setHours(23, 59, 59, 999);
    member.status = 'frozen';
    member.frozenUntil = until;
    member.freezeStartedAt = new Date();
    member.notes.push({
      text: `Membership frozen until ${until.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`,
      authorName: req.user.name,
      at: new Date(),
    });
    await member.save();
    res.json({ member: presentMember(member) });
  }),
);

router.post(
  '/:id/unfreeze',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    if (member.status !== 'frozen') throw httpError(400, 'This membership is not frozen.');
    const extra = member.freezeStartedAt ? Math.max(1, daysBetween(member.freezeStartedAt, new Date())) : 0;
    if (extra && member.endDate) member.endDate = addDays(member.endDate, extra);
    member.status = member.plan?.trial ? 'trial' : 'active';
    member.frozenUntil = null;
    member.freezeStartedAt = null;
    member.notes.push({
      text: extra
        ? `Freeze lifted. ${extra} day${extra === 1 ? '' : 's'} added back to the membership.`
        : 'Freeze lifted.',
      authorName: req.user.name,
      at: new Date(),
    });
    await member.save();
    const populated = await Member.findById(member._id).populate('plan');
    res.json({ member: presentMember(populated) });
  }),
);

router.post(
  '/:id/cancel',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    if (member.status === 'cancelled') throw httpError(400, 'Already cancelled.');
    const reason = String(req.body.reason || '').trim();
    member.status = 'cancelled';
    member.notes.push({
      text: reason ? `Cancelled. ${reason}` : 'Membership cancelled.',
      authorName: req.user.name,
      at: new Date(),
    });
    await member.save();
    res.json({ member: presentMember(member) });
  }),
);

router.post(
  '/:id/renew',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).populate('plan');
    if (!member) throw httpError(404, 'Member not found.');
    const plan = req.body.planId ? await Plan.findById(req.body.planId) : member.plan;
    if (!plan || !plan.active || plan.kind !== 'membership') {
      throw httpError(400, 'Choose an active membership plan.');
    }
    const current = effectiveStatus(member);
    const base = current === 'active' || current === 'trial' ? addDays(startOfDay(member.endDate), 1) : startOfDay();
    if (current === 'expired' || current === 'cancelled' || current === 'frozen') {
      member.startDate = startOfDay();
    }
    member.plan = plan._id;
    member.endDate = membershipEnd(base, plan.durationDays);
    member.status = plan.trial ? 'trial' : 'active';
    member.frozenUntil = null;
    member.freezeStartedAt = null;
    member.notes.push({
      text: `Renewed onto ${plan.name}.`,
      authorName: req.user.name,
      at: new Date(),
    });
    await member.save();

    let payment = null;
    if (req.body.takePayment && plan.price > 0) {
      if (!METHODS.includes(req.body.method)) throw httpError(400, 'Choose how they paid.');
      payment = await Payment.create({
        invoiceNo: await nextInvoice(),
        member: member._id,
        memberName: fullName(member),
        amount: plan.price,
        method: req.body.method,
        status: 'paid',
        type: 'membership',
        description: `${plan.name} renewal`,
        paidAt: new Date(),
        dueDate: new Date(),
        recordedBy: req.user.name,
      });
    }

    const populated = await Member.findById(member._id).populate('plan');
    res.json({ member: presentMember(populated), payment });
  }),
);

export default router;
