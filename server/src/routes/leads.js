import { Router } from 'express';
import { Lead, Member, User } from '../models.js';
import { allow } from '../middleware.js';
import { enrollMember } from '../enroll.js';
import { LOST_REASONS, SOURCES, STAGES, STAGE_LABELS } from '../constants.js';
import { asyncHandler, digits, fullName, httpError } from '../util.js';

const router = Router();
const staff = ['owner', 'front_desk', 'trainer'];
const desk = ['owner', 'front_desk'];

function presentLead(lead) {
  const obj = lead.toObject({ versionKey: false });
  obj.name = fullName(lead);
  return obj;
}

async function loadLead(id) {
  const lead = await Lead.findById(id).populate('owner', 'name role').populate('member', 'code firstName lastName');
  if (!lead) throw httpError(404, 'Enquiry not found.');
  return lead;
}

router.get(
  '/',
  allow(...staff),
  asyncHandler(async (_req, res) => {
    const leads = await Lead.find()
      .populate('owner', 'name role')
      .populate('member', 'code firstName lastName')
      .sort({ nextActionDate: 1, createdAt: -1 });
    res.json({ leads: leads.map(presentLead) });
  }),
);

router.post(
  '/',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const firstName = req.body.firstName?.trim();
    const lastName = req.body.lastName?.trim();
    const phone = req.body.phone?.trim();
    if (!firstName || !lastName) throw httpError(400, 'First and last name are required.');
    if (!phone) throw httpError(400, 'A phone number is required.');
    if (!SOURCES.includes(req.body.source)) throw httpError(400, 'Choose where they came from.');

    const phoneDigits = digits(phone);
    const openLead = await Lead.findOne({
      phoneDigits,
      stage: { $nin: ['converted', 'lost'] },
    });
    if (openLead) {
      throw httpError(409, `${fullName(openLead)} is already in the pipeline with this number.`);
    }
    const member = await Member.findOne({ phoneDigits, status: { $ne: 'cancelled' } });
    if (member) {
      throw httpError(409, `${fullName(member)} is already a member on ${member.code}.`);
    }

    const lead = await Lead.create({
      firstName,
      lastName,
      phone,
      email: req.body.email?.trim().toLowerCase() || '',
      source: req.body.source,
      goal: req.body.goal?.trim() || '',
      preferredTime: req.body.preferredTime?.trim() || '',
      referredBy: req.body.referredBy?.trim() || '',
      stage: 'new',
      owner: req.user._id,
      nextAction: req.body.nextAction?.trim() || 'Call to book the trial',
      nextActionDate: req.body.nextActionDate || new Date(),
      consent: Boolean(req.body.consent),
      activities: [
        {
          kind: 'created',
          text: 'Logged at the desk.',
          authorName: req.user.name,
          at: new Date(),
        },
      ],
    });
    res.status(201).json({ lead: presentLead(await loadLead(lead._id)) });
  }),
);

router.patch(
  '/:id',
  allow(...staff),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw httpError(404, 'Enquiry not found.');
    if (lead.stage === 'converted' && req.body.stage && req.body.stage !== 'converted') {
      throw httpError(400, 'A joined enquiry stays on the member profile.');
    }
    if (req.user.role === 'trainer' && req.body.stage === 'converted') {
      throw httpError(403, 'Ask the desk to take the payment and join them.');
    }

    const previous = lead.stage;
    const fields = ['goal', 'preferredTime', 'source', 'email', 'phone', 'referredBy', 'consent', 'nextAction', 'nextActionDate', 'stage', 'lostReason'];
    for (const field of fields) {
      if (req.body[field] !== undefined) lead[field] = req.body[field];
    }
    if (lead.source && !SOURCES.includes(lead.source)) throw httpError(400, 'Unknown source.');
    if (lead.stage && !STAGES.includes(lead.stage)) throw httpError(400, 'Unknown stage.');
    if (lead.stage === 'lost' && !LOST_REASONS.includes(lead.lostReason)) {
      throw httpError(400, 'Choose why they did not join.');
    }
    if (req.body.owner) {
      const owner = await User.findById(req.body.owner);
      if (!owner) throw httpError(400, 'That teammate does not exist.');
      lead.owner = owner._id;
    }
    if (lead.stage !== previous) {
      lead.activities.push({
        kind: 'stage',
        text: `Moved to ${STAGE_LABELS[lead.stage] || lead.stage}.`,
        authorName: req.user.name,
        at: new Date(),
      });
    }
    await lead.save();
    res.json({ lead: presentLead(await loadLead(lead._id)) });
  }),
);

router.post(
  '/:id/activities',
  allow(...staff),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw httpError(404, 'Enquiry not found.');
    const text = String(req.body.text || '').trim();
    if (!text) throw httpError(400, 'Write what happened.');
    if (req.body.stage === 'converted') throw httpError(400, 'Use join to put them on a plan.');
    const kind = req.body.kind || 'note';
    lead.activities.push({ kind, text, authorName: req.user.name, at: new Date() });
    if ((kind === 'call' || kind === 'whatsapp') && lead.stage === 'new') lead.stage = 'contacted';
    if (req.body.nextAction !== undefined) lead.nextAction = req.body.nextAction;
    if (req.body.nextActionDate !== undefined) lead.nextActionDate = req.body.nextActionDate;
    if (req.body.stage && STAGES.includes(req.body.stage) && req.body.stage !== lead.stage) {
      lead.stage = req.body.stage;
      lead.activities.push({
        kind: 'stage',
        text: `Moved to ${STAGE_LABELS[lead.stage]}.`,
        authorName: req.user.name,
        at: new Date(),
      });
    }
    await lead.save();
    res.json({ lead: presentLead(await loadLead(lead._id)) });
  }),
);

router.post(
  '/:id/convert',
  allow(...desk),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw httpError(404, 'Enquiry not found.');
    if (lead.stage === 'converted') throw httpError(400, 'This enquiry has already joined.');
    if (lead.stage === 'lost') throw httpError(400, 'Reopen the enquiry before joining them.');

    const result = await enrollMember({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      referredBy: lead.referredBy,
      goal: lead.goal,
      planId: req.body.planId,
      startDate: req.body.startDate,
      waiverSigned: req.body.waiverSigned,
      takePayment: req.body.takePayment,
      method: req.body.method,
      openPortal: req.body.openPortal,
      actor: req.user,
    });

    lead.stage = 'converted';
    lead.member = result.member._id;
    lead.nextAction = '';
    lead.nextActionDate = null;
    lead.activities.push({
      kind: 'converted',
      text: `Joined on ${result.member.plan?.name || 'a plan'} as ${result.member.code}.`,
      authorName: req.user.name,
      at: new Date(),
    });
    await lead.save();
    res.status(201).json({ ...result, lead: presentLead(await loadLead(lead._id)) });
  }),
);

export default router;
