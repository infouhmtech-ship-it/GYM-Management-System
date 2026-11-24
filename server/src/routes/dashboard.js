import { CheckIn, Lead, Member, Payment } from '../models.js';
import { asyncHandler, effectiveStatus, fullName, startOfDay, addDays } from '../util.js';

function monthPrice(plan, status) {
  if (!plan || status !== 'active') return 0;
  if (plan.cycle === 'month') return plan.price;
  if (plan.cycle === 'quarter') return plan.price / 3;
  if (plan.cycle === 'year') return plan.price / 12;
  return 0;
}

function weekStart(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export const dashboard = asyncHandler(async (req, res) => {
  const money = req.user.role === 'owner' || req.user.role === 'front_desk';
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const weekAhead = addDays(today, 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [members, leads, payments, checkins] = await Promise.all([
    Member.find().populate('plan'),
    Lead.find().populate('owner', 'name').sort({ nextActionDate: 1 }),
    Payment.find().sort({ createdAt: -1 }),
    CheckIn.find().sort({ at: -1 }).limit(400),
  ]);

  const shaped = members.map((member) => ({
    doc: member,
    status: effectiveStatus(member),
    name: fullName(member),
  }));

  const active = shaped.filter((row) => row.status === 'active');
  const trials = shaped.filter((row) => row.status === 'trial');
  const expiring = shaped
    .filter((row) => row.status === 'active' || row.status === 'trial')
    .filter((row) => {
      const left = Math.round((startOfDay(row.doc.endDate) - today) / 86400000);
      return left >= 0 && left <= 7;
    })
    .sort((a, b) => new Date(a.doc.endDate) - new Date(b.doc.endDate));

  const openLeads = leads.filter((lead) => !['converted', 'lost'].includes(lead.stage));
  const dueLeads = openLeads.filter((lead) => lead.nextActionDate && new Date(lead.nextActionDate) < tomorrow);

  const collectedThisMonth = payments
    .filter((payment) => payment.status === 'paid' && payment.paidAt && new Date(payment.paidAt) >= monthStart)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = payments
    .filter((payment) => payment.status === 'pending' || payment.status === 'failed')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const mrr = active.reduce((sum, row) => sum + monthPrice(row.doc.plan, 'active'), 0);

  const checkinsToday = checkins.filter((visit) => visit.at >= today && visit.result === 'allowed');

  const attendance = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const next = addDays(day, 1);
    attendance.push({
      date: day.toISOString(),
      count: checkins.filter((visit) => visit.result === 'allowed' && visit.at >= day && visit.at < next).length,
    });
  }

  const revenueWeeks = [];
  const thisWeek = weekStart(new Date());
  for (let i = 7; i >= 0; i -= 1) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    revenueWeeks.push({
      week: start.toISOString(),
      amount: payments
        .filter((payment) => payment.status === 'paid' && payment.paidAt && payment.paidAt >= start && payment.paidAt < end)
        .reduce((sum, payment) => sum + payment.amount, 0),
    });
  }

  const sourceIds = ['walk_in', 'google', 'instagram', 'referral', 'website', 'whatsapp', 'event'];
  const sources = sourceIds.map((source) => {
    const group = leads.filter((lead) => lead.source === source);
    const converted = group.filter((lead) => lead.stage === 'converted').length;
    return {
      source,
      leads: group.length,
      converted,
      rate: group.length ? Math.round((converted / group.length) * 100) : 0,
      onFloor: shaped.filter((row) => row.doc.source === source && (row.status === 'active' || row.status === 'trial')).length,
    };
  });

  const decided = leads.filter((lead) => lead.stage === 'converted' || lead.stage === 'lost').length;
  const joined = leads.filter((lead) => lead.stage === 'converted').length;

  res.json({
    hideMoney: !money,
    metrics: {
      activeMembers: active.length,
      trials: trials.length,
      expiring: expiring.length,
      checkinsToday: checkinsToday.length,
      openLeads: openLeads.length,
      followupsDue: dueLeads.length,
      ...(money
        ? {
            mrr: Math.round(mrr),
            collectedThisMonth,
            outstanding,
            joinRate: decided ? Math.round((joined / decided) * 100) : 0,
          }
        : {}),
    },
    attendance,
    revenueWeeks: money ? revenueWeeks : [],
    sources,
    expiring: expiring.slice(0, 6).map((row) => ({
      id: row.doc._id,
      name: row.name,
      code: row.doc.code,
      plan: row.doc.plan?.name || '—',
      endDate: row.doc.endDate,
      phone: row.doc.phone,
    })),
    dueLeads: dueLeads.slice(0, 6).map((lead) => ({
      id: lead._id,
      name: fullName(lead),
      source: lead.source,
      nextAction: lead.nextAction,
      nextActionDate: lead.nextActionDate,
      stage: lead.stage,
      phone: lead.phone,
    })),
    recentCheckins: checkins.slice(0, 8).map((visit) => ({
      id: visit._id,
      name: visit.memberName,
      code: visit.memberCode,
      at: visit.at,
      result: visit.result,
      reason: visit.reason,
    })),
  });
});
