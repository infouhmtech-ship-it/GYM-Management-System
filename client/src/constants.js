export const SOURCES = [
  { id: 'walk_in', label: 'Walk-in' },
  { id: 'google', label: 'Google' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'referral', label: 'Referral' },
  { id: 'website', label: 'Website' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'event', label: 'Event' },
];

export const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'trial_booked', label: 'Trial booked' },
  { id: 'showed', label: 'Showed' },
  { id: 'converted', label: 'Joined' },
  { id: 'lost', label: 'Lost' },
];

export const OPEN_STAGES = ['new', 'contacted', 'trial_booked', 'showed'];

export const LOST_REASONS = [
  { id: 'price', label: 'Price' },
  { id: 'distance', label: 'Too far' },
  { id: 'timing', label: 'Timing does not work' },
  { id: 'not_fit', label: 'Not the right club' },
  { id: 'no_response', label: 'No response' },
  { id: 'other', label: 'Other' },
];

export const METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'transfer', label: 'Bank transfer' },
  { id: 'wallet', label: 'JazzCash / easyPaisa' },
];

export const PAYMENT_TYPES = [
  { id: 'membership', label: 'Membership' },
  { id: 'personal_training', label: 'Personal training' },
  { id: 'retail', label: 'Retail' },
  { id: 'day_pass', label: 'Day pass' },
  { id: 'late_fee', label: 'Late fee' },
];

export const STATUS_LABELS = {
  active: 'Active',
  trial: 'Trial',
  frozen: 'Frozen',
  expired: 'Expired',
  cancelled: 'Cancelled',
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  allowed: 'Allowed',
  denied: 'Denied',
  booked: 'Booked',
  attended: 'Attended',
  no_show: 'No-show',
};

export const ROLE_LABELS = {
  owner: 'Owner',
  front_desk: 'Front desk',
  trainer: 'Coach',
  member: 'Member',
};

export const PREVIEWS = [
  { role: 'Owner', email: 'amina.khan@apex.club' },
  { role: 'Front desk', email: 'omar.desk@apex.club' },
  { role: 'Coach', email: 'hira.coach@apex.club' },
  { role: 'Member', email: 'saad.member@apex.club' },
];

export function homeFor(user) {
  return user?.role === 'member' ? '/me' : '/';
}
