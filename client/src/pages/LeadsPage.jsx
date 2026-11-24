import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LOST_REASONS, METHODS, OPEN_STAGES, SOURCES, STAGES } from '../constants.js';
import { dueInfo, inputDate, labelFor, money, tomorrowInput, whenTime } from '../utils.js';
import { Badge, Banner, Drawer, Empty, Field, Modal, PageHead } from '../components/ui.jsx';

const BLANK_LEAD = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: 'walk_in',
  goal: '',
  preferredTime: '',
  referredBy: '',
  consent: true,
  nextAction: 'Call to book the trial',
  nextActionDate: inputDate(),
};

export default function LeadsPage() {
  const { user } = useAuth();
  const desk = user.role === 'owner' || user.role === 'front_desk';
  const [params] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(params.get('open'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK_LEAD);
  const [convertFor, setConvertFor] = useState(null);
  const [lostFor, setLostFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = leads.find((lead) => lead._id === selectedId) || null;

  async function load() {
    const data = await api('/api/leads');
    setLeads(data.leads);
  }

  useEffect(() => {
    let live = true;
    load().catch((err) => {
      if (live) setError(err.message);
    });
    if (desk) {
      api('/api/plans').then((data) => {
        if (live) setPlans(data.plans.filter((plan) => plan.kind === 'membership' && plan.active));
      }).catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [desk]);

  const sources = useMemo(() => SOURCES.map((source) => {
    const group = leads.filter((lead) => lead.source === source.id);
    const converted = group.filter((lead) => lead.stage === 'converted').length;
    return {
      ...source,
      count: group.length,
      converted,
      rate: group.length ? Math.round((converted / group.length) * 100) : 0,
    };
  }), [leads]);

  const due = leads
    .filter((lead) => !['converted', 'lost'].includes(lead.stage) && lead.nextActionDate && new Date(lead.nextActionDate) < new Date(new Date().setHours(24, 0, 0, 0)))
    .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate));

  const columns = showHistory ? STAGES.map((stage) => stage.id) : OPEN_STAGES;

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

  async function createLead(event) {
    event.preventDefault();
    await run(async () => {
      await api('/api/leads', { method: 'POST', body: draft });
      setCreating(false);
      setDraft(BLANK_LEAD);
      setNotice('Enquiry is on today’s list.');
    });
  }

  function patch(id, body) {
    return run(() => api(`/api/leads/${id}`, { method: 'PATCH', body }));
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow="Organic pipeline"
        title="Who to call before close"
        lede="Walk-ins, Google, Instagram, WhatsApp, referrals, events, and the website share one list. Every open enquiry has an owner and a next step."
      >
        {desk && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Log enquiry
          </button>
        )}
      </PageHead>
      <Banner tone="ok">{notice}</Banner>
      <Banner>{error}</Banner>

      <div className="source-row">
        {sources.map((source) => (
          <article key={source.id} className="source-chip">
            <span>{source.label}</span>
            <strong>{source.count ? `${source.rate}%` : '—'}</strong>
            <p>{source.converted}/{source.count} joined</p>
          </article>
        ))}
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Due now · {due.length}</h2>
        </header>
        {due.length === 0 ? (
          <p className="hint">No calls are overdue or due today.</p>
        ) : (
          <ul className="plain-list">
            {due.map((lead) => {
              const dueState = dueInfo(lead.nextActionDate);
              return (
                <li key={lead._id}>
                  <div>
                    <button type="button" className="text-button" onClick={() => setSelectedId(lead._id)}>
                      <strong>{lead.firstName} {lead.lastName}</strong>
                    </button>
                    <p>{labelFor(SOURCES, lead.source)} · {lead.goal || 'No goal yet'} · {lead.phone}</p>
                    <p>{lead.nextAction}</p>
                  </div>
                  <div className="row-actions">
                    <Badge tone={dueState.tone}>{dueState.text}</Badge>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={busy}
                      onClick={() => run(() => api(`/api/leads/${lead._id}/activities`, {
                        method: 'POST',
                        body: {
                          kind: 'call',
                          text: 'Called from the due list.',
                          nextAction: 'Follow up the call',
                          nextActionDate: tomorrowInput(),
                        },
                      }))}
                    >
                      Called
                    </button>
                    {desk && lead.stage !== 'trial_booked' && lead.stage !== 'showed' && (
                      <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => patch(lead._id, { stage: 'trial_booked', nextAction: 'Confirm they arrive', nextActionDate: tomorrowInput() })}>
                        Book trial
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowHistory((value) => !value)}>
          {showHistory ? 'Hide joined and lost' : 'Show joined and lost'}
        </button>
      </div>

      <div className="board">
        {columns.map((stageId) => {
          const stage = STAGES.find((item) => item.id === stageId);
          const cards = leads.filter((lead) => lead.stage === stageId);
          return (
            <section key={stageId} className="column">
              <header>
                <h2>{stage.label}</h2>
                <span>{cards.length}</span>
              </header>
              {cards.length === 0 && <p className="hint">Clear</p>}
              {cards.map((lead) => (
                <button key={lead._id} type="button" className="lead-card" onClick={() => setSelectedId(lead._id)}>
                  <strong>{lead.firstName} {lead.lastName}</strong>
                  <span>{labelFor(SOURCES, lead.source)}{lead.preferredTime ? ` · ${lead.preferredTime}` : ''}</span>
                  <span>{lead.goal || 'No goal noted'}</span>
                  {!lead.consent && <em>Do not message</em>}
                </button>
              ))}
            </section>
          );
        })}
      </div>

      {creating && (
        <Modal title="Log an enquiry" onClose={() => setCreating(false)}>
          <form className="stack" onSubmit={createLead}>
            <div className="form-grid">
              <Field label="First name"><input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} required /></Field>
              <Field label="Last name"><input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} required /></Field>
              <Field label="Phone"><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required /></Field>
              <Field label="Email"><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
              <Field label="Source">
                <select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })}>
                  {SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
                </select>
              </Field>
              <Field label="Preferred time"><input value={draft.preferredTime} onChange={(event) => setDraft({ ...draft, preferredTime: event.target.value })} /></Field>
              <Field label="Goal" className="wide"><input value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} /></Field>
              {draft.source === 'referral' && (
                <Field label="Referred by" className="wide"><input value={draft.referredBy} onChange={(event) => setDraft({ ...draft, referredBy: event.target.value })} /></Field>
              )}
              <Field label="Next step" className="wide"><input value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} /></Field>
              <Field label="Next step date"><input type="date" value={draft.nextActionDate} onChange={(event) => setDraft({ ...draft, nextActionDate: event.target.value })} /></Field>
            </div>
            <label className="check">
              <input type="checkbox" checked={draft.consent} onChange={(event) => setDraft({ ...draft, consent: event.target.checked })} />
              <span>They agreed to a call or WhatsApp.</span>
            </label>
            <button className="btn btn-primary" disabled={busy} type="submit">Save enquiry</button>
          </form>
        </Modal>
      )}

      {selected && (
        <LeadDrawer
          lead={selected}
          desk={desk}
          busy={busy}
          onClose={() => {
            if (!convertFor && !lostFor) setSelectedId(null);
          }}
          onPatch={(body) => patch(selected._id, body)}
          onActivity={(body) => run(() => api(`/api/leads/${selected._id}/activities`, { method: 'POST', body }))}
          onConvert={() => setConvertFor(selected)}
          onLost={() => setLostFor(selected)}
        />
      )}

      {convertFor && (
        <ConvertModal
          lead={convertFor}
          plans={plans}
          busy={busy}
          onClose={() => setConvertFor(null)}
          onDone={(message) => {
            setNotice(message);
            setConvertFor(null);
            load().catch((err) => setError(err.message));
          }}
        />
      )}

      {lostFor && (
        <LostModal
          busy={busy}
          onClose={() => setLostFor(null)}
          onSave={(lostReason) => {
            setLostFor(null);
            patch(lostFor._id, { stage: 'lost', lostReason, nextAction: '', nextActionDate: null });
          }}
        />
      )}
    </div>
  );
}

function LeadDrawer({ lead, desk, busy, onClose, onPatch, onActivity, onConvert, onLost }) {
  const [note, setNote] = useState('');
  const due = dueInfo(lead.nextActionDate);
  return (
    <Drawer title={`${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <div className="stack">
        <div className="row-actions">
          <Badge tone={lead.stage}>{labelFor(STAGES, lead.stage)}</Badge>
          <Badge tone="muted">{labelFor(SOURCES, lead.source)}</Badge>
          {lead.nextActionDate && <Badge tone={due.tone}>{due.text}</Badge>}
        </div>
        <p>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
        <p>{lead.goal || 'No goal yet'}{lead.preferredTime ? ` · ${lead.preferredTime}` : ''}</p>
        {lead.referredBy && <p>Referred by {lead.referredBy}</p>}
        {lead.owner?.name && <p className="hint">Owner · {lead.owner.name}</p>}
        {!lead.consent && <Banner tone="warn">Do not WhatsApp. They have not agreed to messages. Call or speak in person.</Banner>}
        {lead.member?.code && <p>Joined as {lead.member.code}.</p>}

        {lead.stage !== 'converted' && lead.stage !== 'lost' && (
          <>
            <Field label="Stage">
              <select value={lead.stage} onChange={(event) => onPatch({ stage: event.target.value })}>
                {STAGES.filter((stage) => stage.id !== 'converted').map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Next step">
              <input defaultValue={lead.nextAction || ''} key={`${lead._id}-action`} onBlur={(event) => {
                if (event.target.value !== (lead.nextAction || '')) onPatch({ nextAction: event.target.value });
              }} />
            </Field>
            <Field label="Next step date">
              <input type="date" defaultValue={lead.nextActionDate ? inputDate(lead.nextActionDate) : ''} key={`${lead._id}-date`} onBlur={(event) => onPatch({ nextActionDate: event.target.value || null })} />
            </Field>
          </>
        )}

        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) return;
          onActivity({ kind: 'note', text: note.trim(), nextActionDate: tomorrowInput(), nextAction: lead.nextAction || 'Follow up' });
          setNote('');
        }}>
          <Field label="What happened?">
            <textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Called, no answer. Will try at 6pm." />
          </Field>
          <div className="row-actions">
            <button className="btn btn-ghost btn-small" type="submit" disabled={busy}>Save note</button>
            <button className="btn btn-ghost btn-small" type="button" disabled={busy} onClick={() => onActivity({ kind: 'call', text: note.trim() || 'Called from the desk.', nextAction: 'Follow up the call', nextActionDate: tomorrowInput() })}>Log a call</button>
          </div>
        </form>

        {desk && lead.stage !== 'converted' && lead.stage !== 'lost' && (
          <div className="row-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={onConvert}>Join the club</button>
            <button type="button" className="btn btn-danger btn-small" onClick={onLost}>Mark lost</button>
          </div>
        )}

        <div className="timeline">
          {[...(lead.activities || [])].reverse().map((item, index) => (
            <article key={`${item.at}-${index}`}>
              <strong>{item.authorName}</strong>
              <p>{item.text}</p>
              <span>{whenTime(item.at)}</span>
            </article>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function ConvertModal({ lead, plans, busy, onClose, onDone }) {
  const [planId, setPlanId] = useState(plans.find((plan) => plan.key === 'full')?._id || plans[0]?._id || '');
  const [method, setMethod] = useState('cash');
  const [takePayment, setTakePayment] = useState(true);
  const [openPortal, setOpenPortal] = useState(Boolean(lead.email));
  const [waiver, setWaiver] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const plan = plans.find((item) => item._id === planId);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api(`/api/leads/${lead._id}/convert`, {
        method: 'POST',
        body: {
          planId,
          method,
          takePayment: takePayment && plan?.price > 0,
          openPortal,
          waiverSigned: waiver,
          startDate: inputDate(),
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={`Join ${lead.firstName}`} onClose={() => { if (result) onDone(`${lead.firstName} is now ${result.member.code}.`); else onClose(); }}>
      {result ? (
        <div className="stack">
          <Banner tone="ok">{result.member.name} is {result.member.code} on {result.member.plan?.name}.</Banner>
          {result.portal && (
            <p>Member login {result.portal.email} · temporary password <strong>{result.portal.tempPassword}</strong>. Show it once, it is not stored in plain text.</p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => onDone(`${lead.firstName} is now ${result.member.code}.`)}>Done</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Banner>{error}</Banner>
          <Field label="Plan">
            <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
              {plans.map((item) => (
                <option key={item._id} value={item._id}>{item.name} · {item.price ? money(item.price) : 'Free'}</option>
              ))}
            </select>
          </Field>
          {plan?.price > 0 && (
            <>
              <label className="check">
                <input type="checkbox" checked={takePayment} onChange={(event) => setTakePayment(event.target.checked)} />
                <span>Take {money(plan.price)} now</span>
              </label>
              {takePayment && (
                <Field label="Method">
                  <select value={method} onChange={(event) => setMethod(event.target.value)}>
                    {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={openPortal} onChange={(event) => setOpenPortal(event.target.checked)} />
            <span>Open a member login{lead.email ? ` for ${lead.email}` : ''}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={waiver} onChange={(event) => setWaiver(event.target.checked)} />
            <span>Waiver signed.</span>
          </label>
          <button className="btn btn-primary" disabled={busy || !waiver} type="submit">Confirm join</button>
        </form>
      )}
    </Modal>
  );
}

function LostModal({ busy, onClose, onSave }) {
  const [reason, setReason] = useState('no_response');
  return (
    <Modal title="Why didn’t they join?" onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSave(reason); }}>
        <Field label="Reason">
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {LOST_REASONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>
        <button className="btn btn-danger" disabled={busy} type="submit">Mark lost</button>
      </form>
    </Modal>
  );
}
