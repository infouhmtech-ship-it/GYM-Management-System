import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { STATUS_LABELS } from '../constants.js';
import { clock, money, remaining, when, whenTime } from '../utils.js';
import { Badge, Banner, PageHead } from '../components/ui.jsx';

export default function PortalPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api('/api/portal')
      .then((payload) => { if (live) setData(payload); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, []);

  if (error) return <Banner>{error}</Banner>;
  if (!data) return <p className="hint">Opening your membership…</p>;

  const { member } = data;
  const upcoming = data.classes.filter((session) => new Date(session.startsAt) >= new Date() && session.status === 'booked');

  return (
    <div className="stack">
      <PageHead
        eyebrow="Member"
        title={`Hello, ${member.firstName}`}
        lede={member.goal || 'Your plan, your classes, and the visits on your card.'}
      />
      <section className="portal-hero">
        <div>
          <p className="eyebrow">{member.code}</p>
          <h2>{member.plan?.name || 'Membership'}</h2>
          <p>{remaining(member.daysRemaining)} · ends {when(member.endDate)}</p>
          {member.plan?.access === 'off_peak' && <p className="hint">Your plan covers the floor before 4pm on weekdays, and all day Sunday.</p>}
        </div>
        <Badge tone={member.effectiveStatus}>{STATUS_LABELS[member.effectiveStatus]}</Badge>
      </section>
      <section className="split">
        <article className="panel">
          <header className="panel-head">
            <h2>Upcoming classes</h2>
            <Link to="/schedule">Full schedule</Link>
          </header>
          <ul className="plain-list">
            {upcoming.map((session) => (
              <li key={session._id}>
                <div>
                  <strong>{session.title}</strong>
                  <p>{when(session.startsAt)} · {clock(session.startsAt)} · {session.room} · {session.trainerName}</p>
                </div>
              </li>
            ))}
            {upcoming.length === 0 && <li><p className="hint">Nothing booked. The schedule has open spots.</p></li>}
          </ul>
        </article>
        <article className="panel">
          <h2>Recent visits</h2>
          <ul className="plain-list">
            {data.checkins.map((visit) => (
              <li key={visit._id}>
                <div>
                  <strong>{whenTime(visit.at)}</strong>
                  <p>{visit.reason}</p>
                </div>
                <Badge tone={visit.result}>{STATUS_LABELS[visit.result]}</Badge>
              </li>
            ))}
            {data.checkins.length === 0 && <li><p className="hint">No visits yet.</p></li>}
          </ul>
        </article>
      </section>
      <article className="panel">
        <h2>Payments</h2>
        <ul className="plain-list">
          {data.payments.map((payment) => (
            <li key={payment._id}>
              <div>
                <strong>{payment.description}</strong>
                <p>{payment.invoiceNo} · {when(payment.paidAt || payment.dueDate)}</p>
              </div>
              <span>{money(payment.amount)}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
