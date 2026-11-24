import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { SOURCES } from '../constants.js';
import { money } from '../utils.js';
import { Banner, Field } from '../components/ui.jsx';

const EMPTY = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: 'google',
  goal: '',
  preferredTime: '',
  referredBy: '',
  consent: false,
};

export default function JoinPage() {
  const [form, setForm] = useState(EMPTY);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/public/plans').then((data) => setPlans(data.plans)).catch(() => {});
  }, []);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/public/enquiry', { method: 'POST', body: form });
      setDone(result.message);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <section className="gate-story">
        <p className="eyebrow">Gulberg III · Lahore</p>
        <h1>Three coached sessions. Seven days. Then you decide.</h1>
        <p>
          Tell the desk when you can come in. They call the same day and book real class times,
          not an open invitation to wander in.
        </p>
        <p className="hint">Mon–Sat 6:00–23:00 · Sun 8:00–20:00 · 14-C MM Alam Road</p>
        <div className="rate-mini">
          {plans.filter((plan) => !plan.trial).slice(0, 4).map((plan) => (
            <div key={plan._id}>
              <span>{plan.name}</span>
              <strong>{plan.price ? money(plan.price) : 'Free'}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="gate-panel">
        {done ? (
          <div className="stack">
            <p className="eyebrow">You’re on the list</p>
            <h2>{done}</h2>
            <p>Keep your phone nearby. If you already train here, the desk will open your membership instead.</p>
            <button type="button" className="btn btn-ghost" onClick={() => setDone('')}>Send another</button>
            <Link to="/login">Staff sign in</Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div>
              <p className="eyebrow">Book a trial</p>
              <h2>Tell us how to reach you</h2>
            </div>
            <Banner>{error}</Banner>
            <div className="form-grid">
              <Field label="First name">
                <input value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required />
              </Field>
              <Field label="Last name">
                <input value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="0300-0000000" required />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
              </Field>
              <Field label="How did you hear about APEX?">
                <select value={form.source} onChange={(event) => set('source', event.target.value)}>
                  {SOURCES.map((source) => (
                    <option key={source.id} value={source.id}>{source.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred time">
                <input value={form.preferredTime} onChange={(event) => set('preferredTime', event.target.value)} placeholder="Morning 6–8" />
              </Field>
              {form.source === 'referral' && (
                <Field label="Who sent you?" className="wide">
                  <input value={form.referredBy} onChange={(event) => set('referredBy', event.target.value)} />
                </Field>
              )}
              <Field label="What do you want from training?" className="wide">
                <input value={form.goal} onChange={(event) => set('goal', event.target.value)} />
              </Field>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.consent} onChange={(event) => set('consent', event.target.checked)} />
              <span>The desk may call or WhatsApp me about a trial.</span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Request a trial'}
            </button>
            <Link to="/login">Staff sign in</Link>
          </form>
        )}
      </section>
    </div>
  );
}
