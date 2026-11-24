import bcrypt from 'bcryptjs';
import { Member, Payment, Plan, User } from './models.js';
import { SOURCES, METHODS } from './constants.js';
import {
  digits,
  fullName,
  httpError,
  makeTempPassword,
  membershipEnd,
  presentMember,
  startOfDay,
} from './util.js';
import { nextInvoice, nextMemberCode } from './sequences.js';

export async function enrollMember(input) {
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim().toLowerCase() || '';
  const source = input.source;

  if (!firstName || !lastName) throw httpError(400, 'First and last name are required.');
  if (!phone) throw httpError(400, 'A phone number is required.');
  if (!SOURCES.includes(source)) throw httpError(400, 'Choose where this person came from.');
  if (!input.waiverSigned) throw httpError(400, 'The waiver has to be signed before they train.');

  const plan = await Plan.findById(input.planId);
  if (!plan || !plan.active) throw httpError(400, 'Choose an active plan.');
  if (plan.kind !== 'membership') {
    throw httpError(400, 'Personal training is billed onto a membership, not sold as the membership itself.');
  }

  const phoneDigits = digits(phone);
  const duplicate = await Member.findOne({ phoneDigits, status: { $ne: 'cancelled' } });
  if (duplicate) {
    throw httpError(
      409,
      `${fullName(duplicate)} already has this phone on ${duplicate.code}. Renew that profile instead of creating a second one.`,
    );
  }

  if (input.openPortal) {
    if (!email) throw httpError(400, 'Add an email before opening a member login.');
    const existingLogin = await User.findOne({ email });
    if (existingLogin) throw httpError(400, 'That email already has a login.');
  }

  if (input.takePayment && plan.price > 0 && !METHODS.includes(input.method)) {
    throw httpError(400, 'Choose how they paid.');
  }

  const start = startOfDay(input.startDate || new Date());
  const member = await Member.create({
    code: await nextMemberCode(),
    firstName,
    lastName,
    email,
    phone,
    gender: input.gender || '',
    dateOfBirth: input.dateOfBirth || null,
    emergencyName: input.emergencyName?.trim() || '',
    emergencyPhone: input.emergencyPhone?.trim() || '',
    status: plan.trial ? 'trial' : 'active',
    plan: plan._id,
    startDate: start,
    endDate: membershipEnd(start, plan.durationDays),
    source,
    referredBy: input.referredBy?.trim() || '',
    goal: input.goal?.trim() || '',
    healthNotes: input.healthNotes?.trim() || '',
    waiverSigned: true,
    notes: [
      {
        text: plan.trial ? 'Trial started at the desk.' : 'Joined at the desk.',
        authorName: input.actor?.name || 'Desk',
        at: new Date(),
      },
    ],
  });

  let payment = null;
  if (input.takePayment && plan.price > 0) {
    payment = await Payment.create({
      invoiceNo: await nextInvoice(),
      member: member._id,
      memberName: fullName(member),
      amount: plan.price,
      method: input.method,
      status: 'paid',
      type: 'membership',
      description: `${plan.name}`,
      paidAt: new Date(),
      dueDate: start,
      recordedBy: input.actor?.name || 'Desk',
    });
  }

  let portal = null;
  if (input.openPortal) {
    const tempPassword = makeTempPassword();
    const user = await User.create({
      name: fullName(member),
      email,
      password: await bcrypt.hash(tempPassword, 10),
      role: 'member',
      phone,
      title: 'Member',
      member: member._id,
    });
    member.user = user._id;
    await member.save();
    portal = { email, tempPassword };
  }

  const populated = await Member.findById(member._id).populate('plan');
  return { member: presentMember(populated), payment, portal };
}
