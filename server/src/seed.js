import bcrypt from 'bcryptjs';
import { CheckIn, ClassSession, Counter, Lead, Member, Payment, Plan, User } from './models.js';
import { addDays, digits, fullName, membershipEnd, startOfDay, withinOffPeak } from './util.js';

const PASSWORD = 'apex2026';

function atDay(offset, hour = 0, minute = 0) {
  const date = addDays(startOfDay(), offset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedIfEmpty() {
  if (await User.countDocuments()) {
    console.log('Existing club data found — skipping seed.');
    return;
  }
  await seed();
  console.log('Seeded APEX Athletic Club.');
  console.log('Logins use the password apex2026');
}

async function seed() {
  const rand = mulberry32(20261123);
  const password = await bcrypt.hash(PASSWORD, 10);

  const [amina, omar, hira, rehan] = await User.create([
    { name: 'Amina Khan', email: 'amina.khan@apex.club', password, role: 'owner', phone: '0300-8451100', title: 'Owner' },
    { name: 'Omar Siddiqui', email: 'omar.desk@apex.club', password, role: 'front_desk', phone: '0300-8451101', title: 'Front desk' },
    { name: 'Hira Malik', email: 'hira.coach@apex.club', password, role: 'trainer', phone: '0300-8451102', title: 'Head coach' },
    { name: 'Rehan Qureshi', email: 'rehan.coach@apex.club', password, role: 'trainer', phone: '0300-8451103', title: 'Coach' },
  ]);

  const planDocs = await Plan.insertMany([
    {
      key: 'day', name: 'Day Pass', price: 1500, cycle: 'day', durationDays: 1,
      kind: 'membership', access: 'full',
      description: 'One visit, any hour the club is open.',
      perks: ['Full floor for the day', 'Locker', 'Towel'], active: true,
    },
    {
      key: 'offpeak', name: 'Off-Peak', price: 6500, cycle: 'month', durationDays: 30,
      kind: 'membership', access: 'off_peak',
      description: 'Weekdays before 4pm, and all day Sunday.',
      perks: ['Floor and classes before 4pm', 'All day Sunday', 'Locker'], active: true,
    },
    {
      key: 'full', name: 'Full Membership', price: 9500, cycle: 'month', durationDays: 30,
      kind: 'membership', access: 'full', featured: true,
      description: 'Unlimited floor and classes.',
      perks: ['All opening hours', 'All group classes', 'Locker and towel'], active: true,
    },
    {
      key: 'quarter', name: 'Quarter', price: 25000, cycle: 'quarter', durationDays: 90,
      kind: 'membership', access: 'full', featured: true,
      description: 'Three months up front. The plan most people stay on.',
      perks: ['Everything in Full', 'Freeze up to 14 days', 'One bring-a-friend week'], active: true,
    },
    {
      key: 'annual', name: 'Annual', price: 85000, cycle: 'year', durationDays: 365,
      kind: 'membership', access: 'full',
      description: 'The year, paid once.',
      perks: ['Everything in Quarter', 'Two personal training sessions', 'Priority on popular classes'], active: true,
    },
    {
      key: 'trial', name: 'Trial Week', price: 0, cycle: 'day', durationDays: 7,
      kind: 'membership', access: 'full', trial: true,
      description: 'Three coached sessions inside seven days. Book the dates before they leave the desk.',
      perks: ['Floor access for 7 days', 'Three sessions with a coach'], active: true,
    },
    {
      key: 'pt', name: 'PT Pack · 8', price: 28000, cycle: 'pack', durationDays: 60,
      kind: 'training', access: 'none',
      description: 'Eight personal sessions inside 60 days. Billed onto a member, not a door plan.',
      perks: ['Programming', 'InBody check', 'Eight sessions'], active: true,
    },
  ]);
  const plan = Object.fromEntries(planDocs.map((item) => [item.key, item]));

  const people = [
    { firstName: 'Saad', lastName: 'Raza', email: 'saad.member@apex.club', phone: '0301-5520198', gender: 'Male', plan: 'quarter', status: 'active', source: 'referral', referredBy: 'Fatima Noor', goal: 'Build a 5-day strength habit', healthNotes: 'Old shoulder impingement. No overhead pressing to failure.', start: -40, emergencyName: 'Sara Raza', emergencyPhone: '0300-1112233' },
    { firstName: 'Fatima', lastName: 'Noor', email: 'fatima.noor@email.com', phone: '0321-4481902', gender: 'Female', plan: 'full', status: 'active', source: 'google', goal: 'Return to training after a year off', start: -12 },
    { firstName: 'Bilal', lastName: 'Ahmed', email: 'bilal.ahmed@email.com', phone: '0333-2198841', gender: 'Male', plan: 'annual', status: 'active', source: 'walk_in', goal: 'Stay consistent through the year', start: -140 },
    { firstName: 'Zara', lastName: 'Iqbal', email: 'zara.iqbal@email.com', phone: '0302-6674410', gender: 'Female', plan: 'trial', status: 'trial', source: 'instagram', goal: 'Lose weight without a crash diet', preferredTime: 'Evening', start: -1 },
    { firstName: 'Hamza', lastName: 'Ali', email: 'hamza.ali@email.com', phone: '0345-9081127', gender: 'Male', plan: 'full', status: 'expired', source: 'website', goal: 'General fitness', start: -50, end: -2 },
    { firstName: 'Ayesha', lastName: 'Khan', email: 'ayesha.khan@email.com', phone: '0308-4412900', gender: 'Female', plan: 'quarter', status: 'frozen', source: 'referral', referredBy: 'Sana Javed', goal: 'Strength', healthNotes: 'Lower back — keep deadlifts light until cleared.', start: -30, freezeUntil: 12, freezeStarted: -3 },
    { firstName: 'Usman', lastName: 'Tariq', email: 'usman.tariq@email.com', phone: '0312-7765401', gender: 'Male', plan: 'offpeak', status: 'active', source: 'walk_in', goal: 'Train before work', start: -5 },
    { firstName: 'Mina', lastName: 'Qureshi', email: 'mina.qureshi@email.com', phone: '0300-9182736', gender: 'Female', plan: 'full', status: 'active', source: 'event', goal: 'Wedding in February', start: -25 },
    { firstName: 'Daniyal', lastName: 'Shah', email: 'daniyal.shah@email.com', phone: '0322-6501984', gender: 'Male', plan: 'full', status: 'active', source: 'whatsapp', goal: 'Hypertrophy', start: -2 },
    { firstName: 'Hiba', lastName: 'Farooq', email: 'hiba.farooq@email.com', phone: '0334-1209876', gender: 'Female', plan: 'full', status: 'cancelled', source: 'google', goal: 'Classes', start: -80 },
    { firstName: 'Rohan', lastName: 'Sethi', email: 'rohan.sethi@email.com', phone: '0301-3344556', gender: 'Male', plan: 'quarter', status: 'active', source: 'referral', referredBy: 'Bilal Ahmed', goal: 'Lose 6kg', start: -15 },
    { firstName: 'Sana', lastName: 'Javed', email: 'sana.javed@email.com', phone: '0315-6677889', gender: 'Female', plan: 'full', status: 'active', source: 'instagram', goal: 'Boxing fitness', start: -8 },
    { firstName: 'Imran', lastName: 'Butt', email: 'imran.butt@email.com', phone: '0304-5566771', gender: 'Male', plan: 'offpeak', status: 'expired', source: 'walk_in', goal: 'Lunch-break training', start: -45, end: -6 },
    { firstName: 'Laiba', lastName: 'Hassan', email: 'laiba.hassan@email.com', phone: '0321-9090887', gender: 'Female', plan: 'trial', status: 'trial', source: 'google', goal: 'Learn the machines', start: -4 },
    { firstName: 'Kamran', lastName: 'Ali', email: 'kamran.ali@email.com', phone: '0333-1213141', gender: 'Male', plan: 'annual', status: 'active', source: 'website', goal: 'Stay on a simple program', start: -160 },
    { firstName: 'Noor', lastName: 'Fatima', email: 'noor.fatima@email.com', phone: '0307-4546474', gender: 'Female', plan: 'full', status: 'active', source: 'referral', referredBy: 'Saad Raza', goal: 'Strength, three days a week', start: -26 },
    { firstName: 'Adeel', lastName: 'Hussain', email: 'adeel.hussain@email.com', phone: '0311-2324252', gender: 'Male', plan: 'full', status: 'active', source: 'walk_in', goal: 'Get back in shape', start: -1 },
    { firstName: 'Maham', lastName: 'Shahid', email: 'maham.shahid@email.com', phone: '0345-7678798', gender: 'Female', plan: 'quarter', status: 'active', source: 'instagram', goal: 'Yoga plus lifting', start: -55 },
  ];

  const memberDocs = people.map((person, index) => {
    const chosen = plan[person.plan];
    const start = atDay(person.start, 8, 0);
    const end = person.end != null ? membershipEnd(atDay(person.end), 1) : membershipEnd(start, chosen.durationDays);
    return {
      code: `APX-${1001 + index}`,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      phoneDigits: digits(person.phone),
      gender: person.gender,
      status: person.status,
      plan: chosen._id,
      startDate: start,
      endDate: end,
      frozenUntil: person.freezeUntil != null ? atDay(person.freezeUntil, 23, 59) : null,
      freezeStartedAt: person.freezeStarted != null ? atDay(person.freezeStarted, 9, 0) : null,
      source: person.source,
      referredBy: person.referredBy || '',
      goal: person.goal,
      healthNotes: person.healthNotes || '',
      emergencyName: person.emergencyName || '',
      emergencyPhone: person.emergencyPhone || '',
      waiverSigned: true,
      notes: person.firstName === 'Saad'
        ? [{ text: 'Prefers the 6am strength class. Ask Hira if he misses a week.', authorName: 'Omar Siddiqui', at: atDay(-6, 10, 0) }]
        : person.firstName === 'Mina'
          ? [{ text: 'Expiring this week. Offer the quarter before she pays month-to-month again.', authorName: 'Amina Khan', at: atDay(-1, 18, 0) }]
          : [],
    };
  });

  const members = await Member.insertMany(memberDocs);
  const byEmail = Object.fromEntries(members.map((member) => [member.email, member]));
  const planById = new Map(planDocs.map((item) => [String(item._id), item]));

  const saadUser = await User.create({
    name: 'Saad Raza',
    email: 'saad.member@apex.club',
    password,
    role: 'member',
    phone: '0301-5520198',
    title: 'Member',
    member: byEmail['saad.member@apex.club']._id,
  });
  byEmail['saad.member@apex.club'].user = saadUser._id;
  await byEmail['saad.member@apex.club'].save();

  let invoice = 8100;
  const nextInv = () => {
    invoice += 1;
    return `INV-${invoice}`;
  };

  const payments = [];
  for (const member of members) {
    const chosen = planById.get(String(member.plan));
    if (!chosen || chosen.price === 0 || member.status === 'trial') continue;
    payments.push({
      invoiceNo: nextInv(),
      member: member._id,
      memberName: fullName(member),
      amount: chosen.price,
      method: ['cash', 'card', 'transfer', 'wallet'][payments.length % 4],
      status: 'paid',
      type: 'membership',
      description: `${chosen.name}`,
      paidAt: member.startDate,
      dueDate: member.startDate,
      recordedBy: 'Omar Siddiqui',
    });
  }

  const hamza = byEmail['hamza.ali@email.com'];
  const imran = byEmail['imran.butt@email.com'];
  const saad = byEmail['saad.member@apex.club'];
  const mina = byEmail['mina.qureshi@email.com'];
  payments.push(
    {
      invoiceNo: nextInv(), member: hamza._id, memberName: fullName(hamza), amount: 9500,
      method: 'card', status: 'pending', type: 'membership', description: 'Full Membership renewal',
      dueDate: atDay(-2), recordedBy: 'Omar Siddiqui',
    },
    {
      invoiceNo: nextInv(), member: imran._id, memberName: fullName(imran), amount: 6500,
      method: 'card', status: 'failed', type: 'membership', description: 'Off-peak renewal — card declined',
      dueDate: atDay(-1), recordedBy: 'Omar Siddiqui',
    },
    {
      invoiceNo: nextInv(), member: saad._id, memberName: fullName(saad), amount: 28000,
      method: 'transfer', status: 'paid', type: 'personal_training', description: 'PT Pack · 8 with Hira',
      paidAt: atDay(-9, 11, 0), dueDate: atDay(-9), recordedBy: 'Omar Siddiqui',
    },
    {
      invoiceNo: nextInv(), member: mina._id, memberName: fullName(mina), amount: 1800,
      method: 'cash', status: 'paid', type: 'retail', description: 'Club towel and shaker',
      paidAt: atDay(-3, 19, 0), dueDate: atDay(-3), recordedBy: 'Omar Siddiqui',
    },
    {
      invoiceNo: nextInv(), member: byEmail['sana.javed@email.com']._id, memberName: 'Sana Javed', amount: 9500,
      method: 'wallet', status: 'paid', type: 'membership', description: 'Full Membership renewal',
      paidAt: atDay(-4, 18, 30), dueDate: atDay(-4), recordedBy: 'Omar Siddiqui',
    },
  );
  await Payment.insertMany(payments);

  const doorMembers = members.filter((member) => member.status === 'active' || member.status === 'trial');
  const checkins = [];
  for (let offset = 13; offset >= 1; offset -= 1) {
    const count = 7 + Math.floor(rand() * 6);
    const pool = [...doorMembers];
    for (let n = 0; n < count && pool.length; n += 1) {
      const pick = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const hour = rand() > 0.45 ? 6 + Math.floor(rand() * 3) : 17 + Math.floor(rand() * 3);
      checkins.push({
        member: pick._id,
        memberName: fullName(pick),
        memberCode: pick.code,
        at: atDay(-offset, hour, Math.floor(rand() * 50)),
        result: 'allowed',
        reason: 'Membership is valid.',
        byName: 'Omar Siddiqui',
      });
    }
  }
  const todayVisitors = ['saad.member@apex.club', 'fatima.noor@email.com', 'sana.javed@email.com', 'adeel.hussain@email.com', 'zara.iqbal@email.com'];
  todayVisitors.forEach((email, index) => {
    const member = byEmail[email];
    checkins.push({
      member: member._id,
      memberName: fullName(member),
      memberCode: member.code,
      at: new Date(Date.now() - (35 + index * 28) * 60000),
      result: 'allowed',
      reason: member.status === 'trial' ? 'Trial access is valid.' : 'Membership is valid.',
      byName: 'Omar Siddiqui',
    });
  });
  checkins.push({
    member: hamza._id,
    memberName: fullName(hamza),
    memberCode: hamza.code,
    at: new Date(Date.now() - 18 * 60000),
    result: 'denied',
    reason: 'Membership has expired.',
    byName: 'Omar Siddiqui',
  });
  await CheckIn.insertMany(checkins);

  const coaches = { hira, rehan };
  const templates = [
    { title: 'Dawn Strength', category: 'Strength', hour: 6, minute: 0, duration: 60, capacity: 12, room: 'Studio A', days: [1, 2, 3, 4, 5], coach: 'hira' },
    { title: 'HIIT Burn', category: 'Conditioning', hour: 7, minute: 30, duration: 45, capacity: 16, room: 'Turf', days: [1, 2, 3, 4, 5, 6], coach: 'hira' },
    { title: 'Midday Mobility', category: 'Recovery', hour: 12, minute: 15, duration: 45, capacity: 14, room: 'Studio B', days: [1, 3, 5], coach: 'rehan' },
    { title: 'Sunset Yoga', category: 'Yoga', hour: 18, minute: 0, duration: 60, capacity: 18, room: 'Studio B', days: [0, 1, 2, 3, 4, 6], coach: 'rehan' },
    { title: 'Boxing Conditioning', category: 'Combat', hour: 19, minute: 30, duration: 50, capacity: 10, room: 'Ring', days: [1, 2, 4, 6], coach: 'hira' },
  ];

  let boxingFilled = false;
  const sessions = [];
  for (let offset = -1; offset <= 6; offset += 1) {
    const day = atDay(offset);
    for (const template of templates) {
      if (!template.days.includes(day.getDay())) continue;
      const startsAt = atDay(offset, template.hour, template.minute);
      const endsAt = new Date(startsAt.getTime() + template.duration * 60000);
      const eligible = doorMembers.filter((member) => {
        const chosen = planById.get(String(member.plan));
        if (chosen?.access === 'off_peak' && !withinOffPeak(startsAt)) return false;
        return true;
      });
      const fillBoxing = template.title.startsWith('Boxing') && startsAt > new Date() && !boxingFilled;
      const count = Math.min(eligible.length, fillBoxing ? template.capacity : 3 + Math.floor(rand() * 4));
      if (fillBoxing) boxingFilled = true;
      const pool = [...eligible];
      const bookings = [];
      for (let n = 0; n < count && pool.length; n += 1) {
        const pick = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        bookings.push({
          member: pick._id,
          memberName: fullName(pick),
          memberCode: pick.code,
          status: endsAt < new Date() ? 'attended' : 'booked',
        });
      }
      const coach = coaches[template.coach];
      sessions.push({
        title: template.title,
        category: template.category,
        trainer: coach._id,
        trainerName: coach.name,
        startsAt,
        endsAt,
        capacity: template.capacity,
        room: template.room,
        bookings,
      });
    }
  }
  await ClassSession.insertMany(sessions);

  const leadBlueprints = [
    { firstName: 'Hassan', lastName: 'Riaz', phone: '0300-4412981', email: 'hassan.riaz@email.com', source: 'walk_in', goal: 'Lose 8kg before a wedding', preferredTime: 'Morning 6–8', stage: 'new', next: 0, action: 'Call to lock three trial dates', owner: omar, consent: true },
    { firstName: 'Rabia', lastName: 'Shah', phone: '0321-7781204', email: 'rabia.shah@email.com', source: 'google', goal: 'Beginner strength', preferredTime: 'After 7pm', stage: 'contacted', next: -1, action: 'Second call — no answer yesterday', owner: omar, consent: true },
    { firstName: 'Faisal', lastName: 'Mehmood', phone: '0333-5601212', email: 'faisal.mehmood@email.com', source: 'instagram', goal: 'Boxing, no experience', preferredTime: 'Evening', stage: 'trial_booked', next: 0, action: 'Confirm he shows for boxing', owner: hira, consent: true },
    { firstName: 'Iqra', lastName: 'Nadeem', phone: '0308-9191002', email: 'iqra.nadeem@email.com', source: 'referral', referredBy: 'Fatima Noor', goal: 'Train with Fatima', preferredTime: 'Dawn', stage: 'showed', next: 1, action: 'Ask her to join after session three', owner: hira, consent: true },
    { firstName: 'Junaid', lastName: 'Akhtar', phone: '0312-4046565', email: '', source: 'walk_in', goal: 'Just looking', preferredTime: 'Lunch', stage: 'contacted', next: 0, action: 'Call only — he refused WhatsApp', owner: omar, consent: false },
    { firstName: 'Hania', lastName: 'Mir', phone: '0345-3032141', email: 'hania.mir@email.com', source: 'whatsapp', goal: 'Fat loss', preferredTime: 'Morning', stage: 'new', next: 0, action: 'Reply on WhatsApp and book the trial', owner: omar, consent: true },
    { firstName: 'Talha', lastName: 'Bhatti', phone: '0301-7878781', email: 'talha.bhatti@email.com', source: 'event', goal: 'Came from the Gulberg pop-up', preferredTime: 'Weekend', stage: 'contacted', next: 1, action: 'Send this week’s class times', owner: omar, consent: true },
    { firstName: 'Eman', lastName: 'Saleem', phone: '0322-1415161', email: 'eman.saleem@email.com', source: 'google', goal: 'Knee-friendly training', preferredTime: 'Midday', stage: 'trial_booked', next: 1, action: 'Midday mobility with Rehan', owner: rehan, consent: true },
    { firstName: 'Saad', lastName: 'Qadri', phone: '0334-9897969', email: 'saad.qadri@email.com', source: 'website', goal: 'Asked about annual pricing', preferredTime: 'Evening', stage: 'new', next: -1, action: 'Price follow-up from the website form', owner: omar, consent: true },
    { firstName: 'Maira', lastName: 'Yousaf', phone: '0300-6564738', email: 'maira.yousaf@email.com', source: 'instagram', goal: 'Yoga and strength', preferredTime: 'Sunset', stage: 'showed', next: 0, action: 'She liked yoga — offer the quarter', owner: hira, consent: true },
    { firstName: 'Bilal', lastName: 'Dar', phone: '0315-2021222', email: 'bilal.dar@email.com', source: 'referral', referredBy: 'Rohan Sethi', goal: 'Train with Rohan', preferredTime: 'Evening', stage: 'contacted', next: 2, action: 'Book him beside Rohan’s usual class', owner: omar, consent: true },
    { firstName: 'Nimra', lastName: 'Awan', phone: '0307-8182838', email: 'nimra.awan@email.com', source: 'walk_in', goal: 'Tour only', preferredTime: 'Afternoon', stage: 'lost', next: null, action: '', owner: omar, consent: true, lostReason: 'distance' },
    { firstName: 'Omar', lastName: 'Farooqi', phone: '0321-4455667', email: 'omar.farooqi@email.com', source: 'google', goal: 'Price shopping', preferredTime: 'Any', stage: 'lost', next: null, action: '', owner: omar, consent: true, lostReason: 'price' },
    { firstName: 'Adeel', lastName: 'Hussain', phone: '0311-2324252', email: 'adeel.hussain@email.com', source: 'walk_in', goal: 'Get back in shape', stage: 'converted', owner: omar, memberEmail: 'adeel.hussain@email.com' },
    { firstName: 'Sana', lastName: 'Javed', phone: '0315-6677889', email: 'sana.javed@email.com', source: 'instagram', goal: 'Boxing fitness', stage: 'converted', owner: hira, memberEmail: 'sana.javed@email.com' },
    { firstName: 'Daniyal', lastName: 'Shah', phone: '0322-6501984', email: 'daniyal.shah@email.com', source: 'whatsapp', goal: 'Hypertrophy', stage: 'converted', owner: omar, memberEmail: 'daniyal.shah@email.com' },
    { firstName: 'Noor', lastName: 'Fatima', phone: '0307-4546474', email: 'noor.fatima@email.com', source: 'referral', referredBy: 'Saad Raza', goal: 'Strength', stage: 'converted', owner: omar, memberEmail: 'noor.fatima@email.com' },
    { firstName: 'Kamran', lastName: 'Ali', phone: '0333-1213141', email: 'kamran.ali@email.com', source: 'website', goal: 'Simple program', stage: 'converted', owner: omar, memberEmail: 'kamran.ali@email.com' },
    { firstName: 'Mina', lastName: 'Qureshi', phone: '0300-9182736', email: 'mina.qureshi@email.com', source: 'event', goal: 'Wedding in February', stage: 'converted', owner: omar, memberEmail: 'mina.qureshi@email.com' },
    { firstName: 'Fatima', lastName: 'Noor', phone: '0321-4481902', email: 'fatima.noor@email.com', source: 'google', goal: 'Return to training', stage: 'converted', owner: omar, memberEmail: 'fatima.noor@email.com' },
  ];

  const leads = leadBlueprints.map((item) => {
    const author = item.owner.name;
    const activities = [{ kind: 'created', text: 'Enquiry captured.', authorName: author, at: atDay(-8, 11, 0) }];
    if (['contacted', 'trial_booked', 'showed', 'converted', 'lost'].includes(item.stage)) {
      activities.push({ kind: 'call', text: 'Spoke with them.', authorName: author, at: atDay(-5, 16, 0) });
    }
    if (['trial_booked', 'showed', 'converted'].includes(item.stage)) {
      activities.push({ kind: 'stage', text: 'Trial dates booked before they left.', authorName: author, at: atDay(-3, 12, 0) });
    }
    if (['showed', 'converted'].includes(item.stage)) {
      activities.push({ kind: 'note', text: 'Showed for the first session and finished it.', authorName: 'Hira Malik', at: atDay(-1, 19, 0) });
    }
    if (item.stage === 'lost') {
      activities.push({ kind: 'stage', text: 'Closed without joining.', authorName: author, at: atDay(-1, 13, 0) });
    }
    return {
      firstName: item.firstName,
      lastName: item.lastName,
      phone: item.phone,
      phoneDigits: digits(item.phone),
      email: item.email,
      source: item.source,
      goal: item.goal,
      preferredTime: item.preferredTime || '',
      referredBy: item.referredBy || '',
      stage: item.stage,
      owner: item.owner._id,
      nextAction: item.action || '',
      nextActionDate: item.next == null ? null : atDay(item.next, 9, 0),
      consent: item.consent !== false,
      lostReason: item.lostReason || '',
      member: item.memberEmail ? byEmail[item.memberEmail]._id : null,
      activities,
      createdAt: atDay(item.stage === 'converted' ? -12 : -6, 10, 0),
    };
  });
  await Lead.insertMany(leads);

  await Counter.create([
    { _id: 'member', seq: 1000 + members.length },
    { _id: 'invoice', seq: invoice },
  ]);
}
