import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money } from '../utils.js';
import { Banner, Field, Modal, PageHead } from '../components/ui.jsx';

const CYCLE = { day: 'day', month: 'month', quarter: 'quarter', year: 'year', pack: 'pack' };

export default function PlansPage() {
  const { user } = useAuth();
  const owner = user.role === 'owner';
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api('/api/plans');
    setPlans(data.plans);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const memberships = plans.filter((plan) => plan.kind === 'membership');
  const addons = plans.filter((plan) => plan.kind !== 'membership');

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/plans/${editing._id}`, {
        method: 'PATCH',
        body: {
          name: editing.name,
          price: Number(editing.price),
          description: editing.description,
          active: editing.active,
        },
      });
      setEditing(null);
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
        eyebrow="Rate card"
        title="Plans the desk sells"
        lede="Off-peak stops at 4pm on weekdays. Trial week is three coached sessions, booked before the person leaves the desk. Personal training is billed onto a membership."
      />
      <Banner>{error}</Banner>
      <div className="plan-grid">
        {memberships.map((plan) => (
          <article key={plan._id} className={`plan-card ${plan.featured ? 'featured' : ''} ${plan.active ? '' : 'dim'}`}>
            {plan.featured && <span className="ribbon">Desk favourite</span>}
            <h2>{plan.name}</h2>
            <p className="price">{plan.price ? money(plan.price) : 'Free'} <span>/ {CYCLE[plan.cycle]}</span></p>
            <p>{plan.description}</p>
            <ul>{plan.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>
            {plan.access === 'off_peak' && <p className="hint">Door and classes: before 4pm weekdays, all day Sunday.</p>}
            {!plan.active && <p className="hint">Hidden from new sales.</p>}
            {owner && <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing({ ...plan })}>Edit</button>}
          </article>
        ))}
      </div>
      {addons.length > 0 && (
        <>
          <h2>Add-ons</h2>
          <div className="plan-grid">
            {addons.map((plan) => (
              <article key={plan._id} className="plan-card">
                <h2>{plan.name}</h2>
                <p className="price">{money(plan.price)} <span>/ {CYCLE[plan.cycle]}</span></p>
                <p>{plan.description}</p>
                <ul>{plan.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>
                {owner && <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing({ ...plan })}>Edit</button>}
              </article>
            ))}
          </div>
        </>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Name"><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></Field>
            <Field label="Price (Rs)"><input type="number" min="0" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /></Field>
            <Field label="Description"><textarea rows="3" value={editing.description || ''} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></Field>
            <label className="check">
              <input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
              <span>Available to sell</span>
            </label>
            <button className="btn btn-primary" disabled={busy} type="submit">Save plan</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
