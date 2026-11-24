import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE_LABELS } from '../constants.js';
import { Banner, Field, PageHead } from '../components/ui.jsx';

export default function TeamPage() {
  const { user } = useAuth();
  const owner = user.role === 'owner';
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'trainer', phone: '', title: 'Coach' });

  async function load() {
    const data = await api('/api/staff');
    setStaff(data.staff);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/staff', { method: 'POST', body: form });
      setCreated(result);
      setForm({ name: '', email: '', role: 'trainer', phone: '', title: 'Coach' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Team" title="Who runs the club" lede="Owners see the books. The desk sells, checks people in, and works the pipeline. Coaches mark attendance and follow the trials they own." />
      <Banner>{error}</Banner>
      {created && (
        <Banner tone="ok">
          {created.staff.name} can sign in as {created.staff.email}. Temporary password {created.tempPassword}. It is shown once.
        </Banner>
      )}
      <div className="team-grid">
        {staff.map((person) => (
          <article key={person.id} className="panel">
            <p className="eyebrow">{ROLE_LABELS[person.role]}</p>
            <h2>{person.name}</h2>
            <p>{person.title}</p>
            <p className="hint">{person.email}{person.phone ? ` · ${person.phone}` : ''}</p>
          </article>
        ))}
      </div>
      {owner && (
        <form className="panel stack" onSubmit={submit}>
          <h2>Add a login</h2>
          <div className="form-grid">
            <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <Field label="Role">
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="trainer">Coach</option>
                <option value="front_desk">Front desk</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
          </div>
          <button className="btn btn-primary" disabled={busy} type="submit">Create login</button>
        </form>
      )}
    </div>
  );
}
