import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { METHODS, PAYMENT_TYPES, STATUS_LABELS } from '../constants.js';
import { labelFor, money, when } from '../utils.js';
import { Badge, Banner, Field, Modal, PageHead } from '../components/ui.jsx';

export default function BillingPage() {
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    amount: '',
    method: 'cash',
    type: 'membership',
    description: '',
    status: 'paid',
  });

  async function load() {
    const data = await api('/api/payments');
    setPayments(data.payments);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    api('/api/members').then((data) => setMembers(data.members)).catch(() => {});
  }, []);

  const shown = payments.filter((payment) => {
    const hay = `${payment.memberName} ${payment.invoiceNo} ${payment.description}`.toLowerCase();
    const matchesQuery = hay.includes(query.toLowerCase());
    return matchesQuery && (!status || payment.status === status);
  });
  const collected = payments.filter((payment) => payment.status === 'paid' && payment.paidAt && new Date(payment.paidAt).getMonth() === new Date().getMonth()).reduce((sum, payment) => sum + payment.amount, 0);
  const openAmount = payments.filter((payment) => payment.status === 'pending' || payment.status === 'failed').reduce((sum, payment) => sum + payment.amount, 0);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/payments', { method: 'POST', body: { ...form, amount: Number(form.amount) } });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Money" title="Billing" lede="Memberships, personal training, day passes, and the retail the desk sells. Failed cards stay visible until someone collects them.">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Record payment</button>
      </PageHead>
      <Banner>{error}</Banner>
      <section className="stat-grid">
        <article className="stat"><span>Collected this month</span><strong>{money(collected)}</strong><p>Paid, dated this month</p></article>
        <article className="stat"><span>Still open</span><strong>{money(openAmount)}</strong><p>Pending and failed</p></article>
        <article className="stat"><span>Invoices</span><strong>{payments.length}</strong><p>On this screen</p></article>
      </section>
      <div className="filters">
        <input placeholder="Search member or invoice" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr><th>Invoice</th><th>Member</th><th>For</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {shown.map((payment) => (
              <tr key={payment._id}>
                <td>{payment.invoiceNo}</td>
                <td>{payment.memberName}</td>
                <td>{payment.description || labelFor(PAYMENT_TYPES, payment.type)}</td>
                <td>{money(payment.amount)}</td>
                <td>{labelFor(METHODS, payment.method)}</td>
                <td><Badge tone={payment.status}>{STATUS_LABELS[payment.status]}</Badge></td>
                <td>{when(payment.paidAt || payment.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Record payment" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={save}>
            <Field label="Member">
              <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} required>
                <option value="">Choose</option>
                {members.map((member) => <option key={member._id} value={member._id}>{member.name} · {member.code}</option>)}
              </select>
            </Field>
            <Field label="Amount (Rs)"><input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field>
            <Field label="Type">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {PAYMENT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Note"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </Field>
            <Field label="Method">
              <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </Field>
            <button className="btn btn-primary" disabled={busy} type="submit">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
