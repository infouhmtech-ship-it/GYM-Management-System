import mongoose from 'mongoose';
import { digits } from './util.js';

const noteSchema = new mongoose.Schema(
  {
    text: String,
    authorName: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const activitySchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'note' },
    text: String,
    authorName: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: String,
    memberCode: String,
    status: {
      type: String,
      enum: ['booked', 'attended', 'no_show', 'cancelled'],
      default: 'booked',
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['owner', 'front_desk', 'trainer', 'member'],
      required: true,
    },
    phone: String,
    title: String,
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  { timestamps: true, versionKey: false },
);

const planSchema = new mongoose.Schema(
  {
    key: String,
    name: { type: String, required: true },
    price: { type: Number, required: true },
    cycle: { type: String, enum: ['day', 'month', 'quarter', 'year', 'pack'], required: true },
    durationDays: { type: Number, required: true },
    kind: { type: String, enum: ['membership', 'training'], default: 'membership' },
    access: { type: String, enum: ['full', 'off_peak', 'none'], default: 'full' },
    description: String,
    perks: [String],
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    trial: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

const memberSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, required: true },
    phoneDigits: { type: String, index: true },
    gender: String,
    dateOfBirth: Date,
    emergencyName: String,
    emergencyPhone: String,
    status: {
      type: String,
      enum: ['active', 'expired', 'frozen', 'cancelled', 'trial'],
      default: 'active',
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    startDate: Date,
    endDate: Date,
    frozenUntil: Date,
    freezeStartedAt: Date,
    source: {
      type: String,
      enum: ['walk_in', 'google', 'instagram', 'referral', 'website', 'whatsapp', 'event'],
    },
    referredBy: String,
    goal: String,
    healthNotes: String,
    waiverSigned: { type: Boolean, default: false },
    notes: [noteSchema],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

memberSchema.pre('save', function setPhone(next) {
  this.phoneDigits = digits(this.phone);
  next();
});

const leadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    phoneDigits: { type: String, index: true },
    email: { type: String, default: '' },
    source: {
      type: String,
      enum: ['walk_in', 'google', 'instagram', 'referral', 'website', 'whatsapp', 'event'],
      required: true,
    },
    goal: String,
    preferredTime: String,
    stage: {
      type: String,
      enum: ['new', 'contacted', 'trial_booked', 'showed', 'converted', 'lost'],
      default: 'new',
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nextAction: String,
    nextActionDate: Date,
    consent: { type: Boolean, default: false },
    lostReason: String,
    referredBy: String,
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    activities: [activitySchema],
  },
  { timestamps: true, versionKey: false },
);

leadSchema.pre('save', function setPhone(next) {
  this.phoneDigits = digits(this.phone);
  next();
});

const paymentSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: String,
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'card', 'transfer', 'wallet'] },
    status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'paid' },
    type: {
      type: String,
      enum: ['membership', 'personal_training', 'retail', 'day_pass', 'late_fee'],
      default: 'membership',
    },
    description: String,
    paidAt: Date,
    dueDate: Date,
    recordedBy: String,
  },
  { timestamps: true, versionKey: false },
);

const checkInSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    memberName: String,
    memberCode: String,
    at: { type: Date, default: Date.now, index: true },
    result: { type: String, enum: ['allowed', 'denied'], required: true },
    reason: String,
    byName: String,
  },
  { timestamps: false, versionKey: false },
);

const classSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: String,
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trainerName: String,
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, default: 12 },
    room: String,
    bookings: [bookingSchema],
  },
  { timestamps: true, versionKey: false },
);

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});

export const User = mongoose.model('User', userSchema);
export const Plan = mongoose.model('Plan', planSchema);
export const Member = mongoose.model('Member', memberSchema);
export const Lead = mongoose.model('Lead', leadSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const CheckIn = mongoose.model('CheckIn', checkInSchema);
export const ClassSession = mongoose.model('ClassSession', classSchema);
export const Counter = mongoose.model('Counter', counterSchema);
