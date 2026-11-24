import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { PREVIEWS, homeFor } from '../constants.js';
import { Banner } from '../components/ui.jsx';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('omar.desk@apex.club');
  const [password, setPassword] = useState('apex2026');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate(homeFor(user), { replace: true });
  }, [ready, user, navigate]);

  if (ready && user) return <Navigate to={homeFor(user)} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <section className="gate-story">
        <p className="eyebrow">APEX Athletic Club · Lahore</p>
        <h1>One desk for the floor, the pipeline, and the money.</h1>
        <p>
          Walk-ins, Google, Instagram, WhatsApp, and referrals land in the same queue.
          Trials become members without typing the form twice.
        </p>
        <ul>
          <li>Call the enquiries that are due before close.</li>
          <li>Check a membership before the door opens.</li>
          <li>See which source actually turns into members.</li>
        </ul>
      </section>
      <section className="gate-panel">
        <form className="stack" onSubmit={submit}>
          <div>
            <p className="eyebrow">Staff and members</p>
            <h2>Sign in</h2>
          </div>
          <Banner>{error}</Banner>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" type="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" type="password" required />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Enter the club'}
          </button>
          <div className="preview-row">
            {PREVIEWS.map((preview) => (
              <button
                key={preview.email}
                type="button"
                className="chip"
                onClick={() => {
                  setEmail(preview.email);
                  setPassword('apex2026');
                }}
              >
                {preview.role}
              </button>
            ))}
          </div>
          <p className="hint">Preview password for every sample login is apex2026.</p>
          <Link to="/join">Book a trial instead</Link>
        </form>
      </section>
    </div>
  );
}
