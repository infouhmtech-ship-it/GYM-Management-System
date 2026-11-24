import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { STATUS_LABELS } from '../constants.js';
import { clock, remaining } from '../utils.js';
import { Badge, Banner, PageHead } from '../components/ui.jsx';

export default function CheckInPage() {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [lane, setLane] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLane() {
    const data = await api('/api/checkins');
    setLane(data.checkins);
  }

  useEffect(() => {
    loadLane().catch((err) => setError(err.message));
  }, []);

  async function lookup(event) {
    event?.preventDefault();
    setError('');
    setChosen(null);
    setBusy(true);
    try {
      const data = await api('/api/checkins/lookup', { method: 'POST', body: { query } });
      setMatches(data.matches);
      if (data.matches.length === 1) setChosen(data.matches[0]);
      if (!data.matches.length) setError('Nobody matches that name, phone, or code.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function commit(memberId) {
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/checkins', { method: 'POST', body: { memberId } });
      setChosen({ member: data.member, decision: data.decision, logged: true });
      await loadLane();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const decision = chosen?.decision;

  return (
    <div className="stack">
      <PageHead
        eyebrow="Door"
        title="Check-in"
        lede="Look up a code, phone, or name. The desk sees whether this person should come in before anyone waves them through."
      />
      <Banner>{error}</Banner>
      <div className="split checkin-layout">
        <section className="panel checkin-panel">
          <form onSubmit={lookup} className="stack">
            <input
              className="checkin-input"
              autoFocus
              placeholder="APX-1008 or a phone or name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Looking…' : 'Find member'}
            </button>
          </form>
          {matches.length > 1 && (
            <div className="choice-list">
              {matches.map((match) => (
                <button key={match.member._id} type="button" className="choice" onClick={() => setChosen(match)}>
                  <strong>{match.member.name}</strong>
                  <span>{match.member.code} · {match.member.phone}</span>
                </button>
              ))}
            </div>
          )}
          {chosen && (
            <article className={`decision ${decision.allowed ? 'yes' : 'no'}`}>
              <p className="stamp">{decision.allowed ? 'Open' : 'Hold'}</p>
              <h2>{chosen.member.name}</h2>
              <p>{chosen.member.code} · {chosen.member.plan?.name || 'No plan'} · {remaining(chosen.member.daysRemaining)}</p>
              <p>{decision.reason}</p>
              {chosen.member.healthNotes && <p className="hint">Coach note: {chosen.member.healthNotes}</p>}
              <div className="row-actions">
                {!chosen.logged && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => commit(chosen.member._id)}>
                    Log this visit
                  </button>
                )}
                <Link to={`/members/${chosen.member._id}`}>Open profile</Link>
              </div>
            </article>
          )}
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Today’s lane</h2>
          </header>
          <ul className="plain-list">
            {lane.map((visit) => (
              <li key={visit._id}>
                <div>
                  <strong>{visit.memberName}</strong>
                  <p>{visit.memberCode} · {clock(visit.at)} · {visit.byName}</p>
                  {visit.result === 'denied' && <p>{visit.reason}</p>}
                </div>
                <Badge tone={visit.result}>{STATUS_LABELS[visit.result]}</Badge>
              </li>
            ))}
            {lane.length === 0 && <li><p className="hint">No one has been logged yet today.</p></li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
