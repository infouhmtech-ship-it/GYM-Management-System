import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SOURCES, STATUS_LABELS } from '../constants.js';
import { clock, labelFor, money, when } from '../utils.js';
import { Badge, Banner, PageHead } from '../components/ui.jsx';

function Bars({ rows, value, caption }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="bars" aria-hidden="true">
      {rows.map((row) => (
        <div key={caption(row)} className="bar" title={String(value(row))}>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(value(row) / max) * 100}%` }} />
          </div>
          <span>{caption(row)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const desk = user.role === 'owner' || user.role === 'front_desk';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api('/api/dashboard')
      .then((payload) => {
        if (live) setData(payload);
      })
      .catch((err) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, []);

  if (error) return <Banner>{error}</Banner>;
  if (!data) return <p className="hint">Reading the floor…</p>;

  const cards = [
    ['On the floor', data.metrics.activeMembers, 'Active memberships'],
    ['Trials in', data.metrics.trials, 'People still inside a trial week'],
    ['Due before close', data.metrics.followupsDue, 'Enquiries waiting on a call'],
    ['Visits today', data.metrics.checkinsToday, 'Allowed check-ins'],
  ];
  if (!data.hideMoney) {
    cards.push(
      ['Collected this month', money(data.metrics.collectedThisMonth), 'Paid invoices'],
      ['Still open', money(data.metrics.outstanding), 'Pending and failed'],
      ['Monthly run-rate', money(data.metrics.mrr), 'Active plans, normalised'],
      ['Closed join rate', `${data.metrics.joinRate}%`, 'Joined against joined + lost'],
    );
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow="Floor"
        title="This is the club today"
        lede="Who is in the building, who still needs a call, and which memberships lapse this week."
      />
      <section className="stat-grid">
        {cards.map(([label, value, note]) => (
          <article key={label} className="stat">
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>

      <section className="split">
        <article className="panel">
          <header className="panel-head">
            <h2>Visits, last 14 days</h2>
          </header>
          <Bars
            rows={data.attendance}
            value={(row) => row.count}
            caption={(row) => new Date(row.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          />
        </article>
        {!data.hideMoney && (
          <article className="panel">
            <header className="panel-head">
              <h2>Collected by week</h2>
            </header>
            <Bars
              rows={data.revenueWeeks}
              value={(row) => row.amount}
              caption={(row) => new Date(row.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            />
          </article>
        )}
      </section>

      <section className="split">
        <article className="panel">
          <header className="panel-head">
            <h2>Where members come from</h2>
            <Link to="/leads">Open pipeline</Link>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Enquiries</th>
                  <th>Joined</th>
                  <th>Join rate</th>
                  <th>On the floor</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((source) => (
                  <tr key={source.source}>
                    <td>{labelFor(SOURCES, source.source)}</td>
                    <td>{source.leads}</td>
                    <td>{source.converted}</td>
                    <td>{source.leads ? `${source.rate}%` : '—'}</td>
                    <td>{source.onFloor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <header className="panel-head">
            <h2>Call these today</h2>
            <Link to="/leads">All enquiries</Link>
          </header>
          {data.dueLeads.length === 0 ? (
            <p className="hint">Nothing is waiting. New website enquiries show up here the moment they send the form.</p>
          ) : (
            <ul className="plain-list">
              {data.dueLeads.map((lead) => (
                <li key={lead.id}>
                  <div>
                    <Link to={`/leads?open=${lead.id}`}><strong>{lead.name}</strong></Link>
                    <p>{lead.nextAction || 'No next step'} · {labelFor(SOURCES, lead.source)}</p>
                  </div>
                  <Badge tone={lead.stage}>{lead.stage === 'new' ? 'New' : lead.stage.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="split">
        <article className="panel">
          <header className="panel-head">
            <h2>Lapsing this week</h2>
            <Link to="/members">Members</Link>
          </header>
          <ul className="plain-list">
            {data.expiring.map((member) => (
              <li key={member.id}>
                <div>
                  <Link to={`/members/${member.id}`}><strong>{member.name}</strong></Link>
                  <p>{member.plan} · ends {when(member.endDate)} · {member.phone}</p>
                </div>
                <span className="hint">{member.code}</span>
              </li>
            ))}
            {data.expiring.length === 0 && <li><p className="hint">No memberships end in the next seven days.</p></li>}
          </ul>
        </article>
        <article className="panel">
          <header className="panel-head">
            <h2>Latest door</h2>
            {desk && <Link to="/check-in">Check-in</Link>}
          </header>
          <ul className="plain-list">
            {data.recentCheckins.map((visit) => (
              <li key={visit.id}>
                <div>
                  <strong>{visit.name}</strong>
                  <p>{visit.code} · {clock(visit.at)}{visit.result === 'denied' ? ` · ${visit.reason}` : ''}</p>
                </div>
                <Badge tone={visit.result}>{STATUS_LABELS[visit.result]}</Badge>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
