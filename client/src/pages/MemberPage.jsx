import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { METHODS, SOURCES, STATUS_LABELS } from '../constants.js';
import { inputDate, labelFor, money, remaining, when, whenTime } from '../utils.js';
import { Badge, Banner, Field, Modal, PageHead } from '../components/ui.jsx';

export default function MemberPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const desk = user.role === 'owner' || user.role === 'front_desk';
  const [pack, setPack] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api(`/api/members/${id}`);
    setPack(data);
  }

  useEffect(() => {
    let live = true;
    setPack(null);
    api(`/api/members/${id}`)
      .then((data) => { if (live) setPack(data); })
      .catch((err) => { if (live) setError(err.message); });
    if (desk) {
      api('/api/plans').then((data) => {
        if (live) setPlans(data.plans.filter((plan) => plan.kind === 'membership' && plan.active));
      }).catch(() => {});
    }
    return () => { live = false; };
  }, [id, desk]);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result?.member) setPack((current) => ({ ...current, member: result.member }));
      if (result?.reload) await load();
      setMode('');
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error && !pack) return <Banner>{error}</Banner>;
  if (!pack) return <p className="hint">Opening the profile…</p>;

  const member = pack.member;
  const status = member.effectiveStatus;

  return (
    <div className="stack">
      <PageHead eyebrow={member.code} title={member.name} lede={`${member.plan?.name || 'No plan'} · ${remaining(member.daysRemaining)} · came in via ${labelFor(SOURCES, member.source)}${member.referredBy ? ` (${member.referredBy})` : ''}`}>
        <Badge tone={status}>{STATUS_LABELS[status]}</Badge>
      </PageHead>
      <Link to="/members">Back to members</Link>
      <Banner tone="ok">{notice}</Banner>
      <Banner>{error}</Banner>

      {desk && (
        <div className="row-actions">
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => run(async () => {
            const result = await api('/api/checkins', { method: 'POST', body: { memberId: member._id } });
            setNotice(`${result.decision.allowed ? 'Door open' : 'Hold'}: ${result.decision.reason}`);
            return { reload: true };
          })}>Check in</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setMode('pay')}>Record payment</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setMode('renew')}>Renew</button>
          {status === 'frozen' ? (
            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(() => api(`/api/members/${member._id}/unfreeze`, { method: 'POST', body: {} }))}>Lift freeze</button>
          ) : status !== 'cancelled' && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setMode('freeze')}>Freeze</button>
          )}
          {status !== 'cancelled' && (
            <button type="button" className="btn btn-danger btn-small" onClick={() => setMode('cancel')}>Cancel</button>
          )}
        </div>
      )}

      <section className="split">
        <article className="panel stack">
          <h2>Profile</h2>
          <p>{member.phone}{member.email ? ` · ${member.email}` : ''}</p>
          <p>{member.goal || 'No goal noted'}</p>
          {member.healthNotes && <p>Health: {member.healthNotes}</p>}
          <p className="hint">
            {member.emergencyName ? `Emergency ${member.emergencyName} ${member.emergencyPhone || ''}` : 'No emergency contact'}
            {' · '}
            {member.waiverSigned ? 'Waiver signed' : 'Waiver missing'}
          </p>
          <p className="hint">Started {when(member.startDate)} · ends {when(member.endDate)}{member.frozenUntil ? ` · frozen until ${when(member.frozenUntil)}` : ''}</p>
          {desk && <ContactForm key={member._id} member={member} busy={busy} onSave={(body) => run(() => api(`/api/members/${member._id}`, { method: 'PATCH', body }))} />}
        </article>
        <article className="panel stack">
          <h2>Notes</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            run(async () => {
              const result = await api(`/api/members/${member._id}/notes`, { method: 'POST', body: { text: note.trim() } });
              setNote('');
              return result;
            });
          }}>
            <Field label="Add a note">
              <textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <button className="btn btn-ghost btn-small" type="submit" disabled={busy}>Save note</button>
          </form>
          <div className="timeline">
            {[...(member.notes || [])].reverse().map((item, index) => (
              <article key={`${item.at}-${index}`}>
                <strong>{item.authorName}</strong>
                <p>{item.text}</p>
                <span>{whenTime(item.at)}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="split">
        <article className="panel">
          <h2>Visits</h2>
          <ul className="plain-list">
            {pack.checkins.map((visit) => (
              <li key={visit._id}>
                <div>
                  <strong>{whenTime(visit.at)}</strong>
                  <p>{visit.reason}</p>
                </div>
                <Badge tone={visit.result}>{STATUS_LABELS[visit.result]}</Badge>
              </li>
            ))}
            {pack.checkins.length === 0 && <li><p className="hint">No visits logged.</p></li>}
          </ul>
        </article>
        <article className="panel">
          <h2>Classes</h2>
          <ul className="plain-list">
            {pack.sessions.map((session) => (
              <li key={session._id}>
                <div>
                  <strong>{session.title}</strong>
                  <p>{whenTime(session.startsAt)} · {session.room} · {session.trainerName}</p>
                </div>
                <Badge tone={session.status}>{STATUS_LABELS[session.status] || session.status}</Badge>
              </li>
            ))}
            {pack.sessions.length === 0 && <li><p className="hint">No class bookings.</p></li>}
          </ul>
        </article>
      </section>

      {pack.canBill && (
        <article className="panel">
          <h2>Billing</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Invoice</th><th>For</th><th>Amount</th><th>Status</th><th>When</th></tr>
              </thead>
              <tbody>
                {pack.payments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{payment.invoiceNo}</td>
                    <td>{payment.description}</td>
                    <td>{money(payment.amount)}</td>
                    <td><Badge tone={payment.status}>{STATUS_LABELS[payment.status]}</Badge></td>
                    <td>{when(payment.paidAt || payment.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {mode === 'freeze' && (
        <FreezeModal busy={busy} onClose={() => setMode('')} onSave={(until) => run(() => api(`/api/members/${member._id}/freeze`, { method: 'POST', body: { until } }))} />
      )}
      {mode === 'cancel' && (
        <ReasonModal title="Cancel membership" label="Why is it ending?" busy={busy} onClose={() => setMode('')} onSave={(reason) => run(() => api(`/api/members/${member._id}/cancel`, { method: 'POST', body: { reason } }))} />
      )}
      {mode === 'renew' && (
        <RenewModal member={member} plans={plans} busy={busy} onClose={() => setMode('')} onSave={(body) => run(async () => {
          const result = await api(`/api/members/${member._id}/renew`, { method: 'POST', body });
          setNotice(`Renewed onto ${result.member.plan?.name}.`);
          return { ...result, reload: true };
        })} />
      )}
      {mode === 'pay' && (
        <PayModal member={member} busy={busy} onClose={() => setMode('')} onSave={(body) => run(async () => {
          await api('/api/payments', { method: 'POST', body: { ...body, memberId: member._id } });
          setNotice('Payment recorded.');
          return { reload: true };
        })} />
      )}
    </div>
  );
}

function ContactForm({ member, busy, onSave }) {
  const [form, setForm] = useState({
    phone: member.phone || '',
    email: member.email || '',
    goal: member.goal || '',
    healthNotes: member.healthNotes || '',
    emergencyName: member.emergencyName || '',
    emergencyPhone: member.emergencyPhone || '',
  });
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
      <div className="form-grid">
        <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="Email"><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Goal" className="wide"><input value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} /></Field>
        <Field label="Health note" className="wide"><input value={form.healthNotes} onChange={(event) => setForm({ ...form, healthNotes: event.target.value })} /></Field>
        <Field label="Emergency name"><input value={form.emergencyName} onChange={(event) => setForm({ ...form, emergencyName: event.target.value })} /></Field>
        <Field label="Emergency phone"><input value={form.emergencyPhone} onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })} /></Field>
      </div>
      <button className="btn btn-ghost btn-small" disabled={busy} type="submit">Save profile</button>
    </form>
  );
}

function FreezeModal({ busy, onClose, onSave }) {
  const [until, setUntil] = useState(inputDate(new Date(Date.now() + 14 * 86400000)));
  return (
    <Modal title="Freeze membership" onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave(until); }}>
        <p className="hint">Quarter and annual plans include up to 14 freeze days. The days they were frozen are added back when you lift it.</p>
        <Field label="Frozen until"><input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></Field>
        <button className="btn btn-primary" disabled={busy} type="submit">Freeze</button>
      </form>
    </Modal>
  );
}

function ReasonModal({ title, label, busy, onClose, onSave }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave(reason); }}>
        <Field label={label}><input value={reason} onChange={(event) => setReason(event.target.value)} required /></Field>
        <button className="btn btn-danger" disabled={busy} type="submit">Confirm</button>
      </form>
    </Modal>
  );
}

function RenewModal({ member, plans, busy, onClose, onSave }) {
  const [planId, setPlanId] = useState(member.plan?._id || plans[0]?._id || '');
  const [method, setMethod] = useState('cash');
  const [takePayment, setTakePayment] = useState(true);
  const plan = plans.find((item) => item._id === planId);
  return (
    <Modal title="Renew" onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave({ planId, method, takePayment: takePayment && plan?.price > 0 }); }}>
        <Field label="Plan">
          <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {plans.map((item) => <option key={item._id} value={item._id}>{item.name} · {money(item.price)}</option>)}
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={takePayment} onChange={(event) => setTakePayment(event.target.checked)} />
          <span>Take payment now{plan ? ` · ${money(plan.price)}` : ''}</span>
        </label>
        {takePayment && (
          <Field label="Method">
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">Renew membership</button>
      </form>
    </Modal>
  );
}

function PayModal({ busy, onClose, onSave }) {
  const [form, setForm] = useState({ amount: '', method: 'cash', type: 'retail', description: '', status: 'paid' });
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, amount: Number(form.amount) }); }}>
        <Field label="Amount (Rs)"><input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field>
        <Field label="For">
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="membership">Membership</option>
            <option value="personal_training">Personal training</option>
            <option value="retail">Retail</option>
            <option value="day_pass">Day pass</option>
            <option value="late_fee">Late fee</option>
          </select>
        </Field>
        <Field label="Note"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Towel, PT pack, renewal…" /></Field>
        <Field label="Method">
          <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
            {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>
        <button className="btn btn-primary" disabled={busy} type="submit">Save payment</button>
      </form>
    </Modal>
  );
}
