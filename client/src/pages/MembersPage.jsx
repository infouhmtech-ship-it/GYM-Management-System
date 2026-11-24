import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { METHODS, SOURCES, STATUS_LABELS } from '../constants.js';
import { inputDate, labelFor, money, remaining, when } from '../utils.js';
import { Badge, Banner, Empty, Field, Modal, PageHead } from '../components/ui.jsx';

const BLANK = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  gender: '',
  source: 'walk_in',
  referredBy: '',
  goal: '',
  emergencyName: '',
  emergencyPhone: '',
  planId: '',
  method: 'cash',
  takePayment: true,
  waiverSigned: false,
  openPortal: false,
  startDate: inputDate(),
};

export default function MembersPage() {
  const { user } = useAuth();
  const desk = user.role === 'owner' || user.role === 'front_desk';
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    const data = await api(`/api/members?${params.toString()}`);
    setMembers(data.members);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((err) => setError(err.message));
    }, 180);
    return () => clearTimeout(timer);
  }, [q, status, source]);

  useEffect(() => {
    if (!desk) return;
    api('/api/plans').then((data) => {
      const memberships = data.plans.filter((plan) => plan.kind === 'membership' && plan.active);
      setPlans(memberships);
      setForm((current) => ({ ...current, planId: current.planId || memberships.find((plan) => plan.key === 'full')?._id || memberships[0]?._id || '' }));
    }).catch(() => {});
  }, [desk]);

  const chosen = plans.find((plan) => plan._id === form.planId);

  async function createMember(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/members', {
        method: 'POST',
        body: {
          ...form,
          takePayment: form.takePayment && chosen?.price > 0,
        },
      });
      setOpen(false);
      setNotice(`${result.member.name} is ${result.member.code}.${result.portal ? ` Login ${result.portal.email} / ${result.portal.tempPassword}` : ''}`);
      setForm((current) => ({ ...BLANK, planId: current.planId }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow="Members"
        title="People on a plan"
        lede="Active members, trials, freezes, and the ones who already lapsed. Renew from the profile instead of creating a second record."
      >
        {desk && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>New member</button>}
      </PageHead>
      <Banner tone="ok">{notice}</Banner>
      <Banner>{error}</Banner>
      <div className="filters">
        <input placeholder="Search name, phone, or code" value={q} onChange={(event) => setQ(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          {['active', 'trial', 'frozen', 'expired', 'cancelled'].map((item) => (
            <option key={item} value={item}>{STATUS_LABELS[item]}</option>
          ))}
        </select>
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">Any source</option>
          {SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Source</th>
              <th>Ends</th>
              <th>Last visit</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member._id}>
                <td>
                  <Link to={`/members/${member._id}`}><strong>{member.name}</strong></Link>
                  <p className="hint">{member.code} · {member.phone}</p>
                </td>
                <td>{member.plan?.name || '—'}</td>
                <td><Badge tone={member.effectiveStatus}>{STATUS_LABELS[member.effectiveStatus]}</Badge></td>
                <td>{labelFor(SOURCES, member.source)}</td>
                <td>{remaining(member.daysRemaining)}</td>
                <td>{when(member.lastVisit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <Empty title="No members" text="Nothing matches those filters." />}
      </div>

      {open && (
        <Modal title="New member" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={createMember}>
            <div className="form-grid">
              <Field label="First name"><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
              <Field label="Last name"><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field>
              <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Source">
                <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
                  {SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Plan">
                <select value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })}>
                  {plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name} · {plan.price ? money(plan.price) : 'Free'}</option>)}
                </select>
              </Field>
              {form.source === 'referral' && (
                <Field label="Referred by" className="wide"><input value={form.referredBy} onChange={(event) => setForm({ ...form, referredBy: event.target.value })} /></Field>
              )}
              <Field label="Goal" className="wide"><input value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} /></Field>
              <Field label="Emergency name"><input value={form.emergencyName} onChange={(event) => setForm({ ...form, emergencyName: event.target.value })} /></Field>
              <Field label="Emergency phone"><input value={form.emergencyPhone} onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })} /></Field>
            </div>
            {chosen?.price > 0 && (
              <label className="check">
                <input type="checkbox" checked={form.takePayment} onChange={(event) => setForm({ ...form, takePayment: event.target.checked })} />
                <span>Take {money(chosen.price)} now</span>
              </label>
            )}
            {form.takePayment && chosen?.price > 0 && (
              <Field label="Method">
                <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                  {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Field>
            )}
            <label className="check">
              <input type="checkbox" checked={form.openPortal} onChange={(event) => setForm({ ...form, openPortal: event.target.checked })} />
              <span>Open a member login</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.waiverSigned} onChange={(event) => setForm({ ...form, waiverSigned: event.target.checked })} />
              <span>Waiver signed.</span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy || !form.waiverSigned}>Save member</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
