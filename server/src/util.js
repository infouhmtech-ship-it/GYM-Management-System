export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function startOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(input, days) {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(a, b) {
  return Math.max(0, Math.round((startOfDay(b) - startOfDay(a)) / 86400000));
}

export function membershipEnd(start, durationDays) {
  const end = startOfDay(start);
  end.setDate(end.getDate() + Math.max(1, durationDays) - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function fullName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
}

export function effectiveStatus(member, now = new Date()) {
  if (!member) return 'expired';
  const today = startOfDay(now);
  if (member.status === 'cancelled') return 'cancelled';
  if (member.status === 'frozen') {
    const stillFrozen = !member.frozenUntil || startOfDay(member.frozenUntil) >= today;
    if (stillFrozen) return 'frozen';
  }
  if (member.endDate && startOfDay(member.endDate) < today) return 'expired';
  if (member.status === 'trial') return 'trial';
  return 'active';
}

export function withinOffPeak(date) {
  const day = date.getDay();
  const hour = date.getHours();
  if (day === 0) return true;
  return day >= 1 && day <= 5 && hour < 16;
}

export function accessDecision(member, plan, now = new Date()) {
  const status = effectiveStatus(member, now);
  if (status === 'frozen') {
    return { allowed: false, status, reason: 'Membership is frozen.' };
  }
  if (status === 'cancelled') {
    return { allowed: false, status, reason: 'Membership is cancelled.' };
  }
  if (status === 'expired') {
    return { allowed: false, status, reason: 'Membership has expired.' };
  }
  if (plan?.access === 'none') {
    return {
      allowed: false,
      status,
      reason: 'This pack does not include open-floor access.',
    };
  }
  if (plan?.access === 'off_peak' && !withinOffPeak(now)) {
    return {
      allowed: false,
      status,
      reason: 'Off-peak plan. Entry is before 4pm on weekdays, or any time on Sunday.',
    };
  }
  return {
    allowed: true,
    status,
    reason: status === 'trial' ? 'Trial access is valid.' : 'Membership is valid.',
  };
}

export function presentMember(member) {
  const obj = member.toObject({ versionKey: false });
  obj.effectiveStatus = effectiveStatus(member);
  obj.name = fullName(member);
  obj.daysRemaining = member.endDate
    ? Math.round((startOfDay(member.endDate) - startOfDay(new Date())) / 86400000)
    : null;
  return obj;
}

export function makeTempPassword() {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let tail = '';
  for (let i = 0; i < 4; i += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `apex-${tail}`;
}

export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    title: user.title || '',
    member: user.member || null,
  };
}
