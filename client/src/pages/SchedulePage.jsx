import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { STATUS_LABELS } from '../constants.js';
import { addDays, clock, inputDate, startOfDay, when } from '../utils.js';
import { Badge, Banner, Field, Modal, PageHead } from '../components/ui.jsx';

export default function SchedulePage() {
  const { user } = useAuth();
  const staff = user.role !== 'member';
  const [classes, setClasses] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [booking, setBooking] = useState(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const from = startOfDay(addDays(new Date(), -1)).toISOString();
    const to = startOfDay(addDays(new Date(), 8)).toISOString();
    const data = await api(`/api/classes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    setClasses(data.classes);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    if (staff) {
      api('/api/members').then((data) => setMembers(data.members)).catch(() => {});
      api('/api/staff').then((data) => setTrainers(data.staff.filter((person) => person.role === 'trainer' || person.role === 'owner'))).catch(() => {});
    }
  }, [staff]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const session of classes) {
      const key = when(session.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    }
    return [...map.entries()];
  }, [classes]);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const filteredMembers = members.filter((member) => {
    const hay = `${member.name} ${member.code}`.toLowerCase();
    return hay.includes(query.toLowerCase()) && ['active', 'trial'].includes(member.effectiveStatus);
  }).slice(0, 8);

  return (
    <div className="stack">
      <PageHead
        eyebrow="Timetable"
        title="Classes this week"
        lede="Book a real spot. Off-peak members can join classes before 4pm on weekdays, and any time on Sunday."
      >
        {staff && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Add class</button>}
      </PageHead>
      <Banner tone="ok">{notice}</Banner>
      <Banner>{error}</Banner>
      {groups.map(([day, sessions]) => (
        <section key={day} className="stack">
          <h2 className="day-label">{day}</h2>
          <div className="class-grid">
            {sessions.map((session) => {
              const live = session.bookings.filter((item) => item.status !== 'cancelled');
              const mine = session.bookings.find((item) => String(item.member) === String(user.member) && item.status !== 'cancelled');
              const full = live.length >= session.capacity;
              return (
                <article key={session._id} className="class-card">
                  <header>
                    <div>
                      <p className="eyebrow">{session.category}</p>
                      <h3>{session.title}</h3>
                    </div>
                    <span>{clock(session.startsAt)}–{clock(session.endsAt)}</span>
                  </header>
                  <p>{session.trainerName} · {session.room}</p>
                  <div className="meter" aria-label={`${live.length} of ${session.capacity} booked`}>
                    <span style={{ width: `${Math.min(100, (live.length / session.capacity) * 100)}%` }} />
                  </div>
                  <p className="hint">{live.length}/{session.capacity}{full ? ' · Full' : ''}</p>
                  {staff && (
                    <ul className="booking-list">
                      {live.map((item) => (
                        <li key={String(item.member)}>
                          <span>{item.memberName}</span>
                          <span className="row-actions">
                            <Badge tone={item.status}>{STATUS_LABELS[item.status]}</Badge>
                            {item.status === 'booked' && (
                              <>
                                <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(() => api(`/api/classes/${session._id}/attendance`, { method: 'POST', body: { memberId: item.member, status: 'attended' } }))}>Here</button>
                                <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(() => api(`/api/classes/${session._id}/attendance`, { method: 'POST', body: { memberId: item.member, status: 'no_show' } }))}>No-show</button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="row-actions">
                    {staff && <button type="button" className="btn btn-ghost btn-small" disabled={full} onClick={() => { setBooking(session); setQuery(''); }}>Book member</button>}
                    {!staff && !mine && <button type="button" className="btn btn-primary btn-small" disabled={busy || full} onClick={() => run(async () => { await api(`/api/classes/${session._id}/book`, { method: 'POST', body: {} }); setNotice(`Booked ${session.title}.`); })}>Book</button>}
                    {!staff && mine?.status === 'booked' && <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(() => api(`/api/classes/${session._id}/cancel`, { method: 'POST', body: {} }))}>Cancel my spot</button>}
                    {!staff && mine && mine.status !== 'booked' && <Badge tone={mine.status}>{STATUS_LABELS[mine.status]}</Badge>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {booking && (
        <Modal title={`Book ${booking.title}`} onClose={() => setBooking(null)}>
          <div className="stack">
            <Banner>{error}</Banner>
            <Field label="Find a member">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or code" autoFocus />
            </Field>
            <div className="choice-list">
              {filteredMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  className="choice"
                  disabled={busy}
                  onClick={() => run(async () => {
                    await api(`/api/classes/${booking._id}/book`, { method: 'POST', body: { memberId: member._id } });
                    setNotice(`${member.name} is booked into ${booking.title}.`);
                    setBooking(null);
                  })}
                >
                  <strong>{member.name}</strong>
                  <span>{member.code} · {member.plan?.name}</span>
                </button>
              ))}
              {query && filteredMembers.length === 0 && <p className="hint">No active member matches.</p>}
            </div>
          </div>
        </Modal>
      )}

      {creating && <ClassModal trainers={trainers} user={user} busy={busy} onClose={() => setCreating(false)} onSave={(body) => run(async () => { await api('/api/classes', { method: 'POST', body }); setCreating(false); setNotice('Class added.'); })} />}
    </div>
  );
}

function ClassModal({ trainers, user, busy, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    category: 'Strength',
    date: inputDate(),
    time: '18:00',
    duration: 60,
    capacity: 12,
    room: 'Studio A',
    trainerId: trainers.find((person) => person.id === user.id)?.id || trainers[0]?.id || '',
  });
  return (
    <Modal title="Add a class" onClose={onClose}>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        const startsAt = new Date(`${form.date}T${form.time}`);
        onSave({ ...form, startsAt, duration: Number(form.duration), capacity: Number(form.capacity) });
      }}>
        <Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
        <div className="form-grid">
          <Field label="Date"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Start"><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></Field>
          <Field label="Minutes"><input type="number" min="20" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></Field>
          <Field label="Capacity"><input type="number" min="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field>
          <Field label="Room"><input value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} /></Field>
          <Field label="Coach">
            <select value={form.trainerId} onChange={(event) => setForm({ ...form, trainerId: event.target.value })}>
              {trainers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">Save class</button>
      </form>
    </Modal>
  );
}
