import { useCallback, useEffect, useState } from 'react';
import { getAdoptionRequests } from '../api.js';

export function AdoptionRequestsPage({ refreshKey = 0 }) {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState({ type: 'loading' });
  const load = useCallback(async () => {
    setStatus({ type: 'loading' });
    try { const result = await getAdoptionRequests(); setRequests(result.adoptionRequests || []); setStatus({ type: 'ready' }); }
    catch (error) { setStatus({ type: 'error', message: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  return (
    <section className="page-section" aria-labelledby="requests-title">
      <p className="eyebrow">Your next steps</p><h1 id="requests-title">My adoption requests</h1><p className="page-intro">Track the applications you have sent to our adoption team.</p>
      {status.type === 'loading' && <p className="loading-message">Loading your requests…</p>}
      {status.type === 'error' && <div className="state-panel error-panel" role="alert"><p>{status.message}</p><button className="button button-secondary" type="button" onClick={load}>Try again</button></div>}
      {status.type === 'ready' && requests.length === 0 && <div className="state-panel"><h2>No requests yet</h2><p>When you apply for a pet, your application will appear here.</p><a className="button button-primary" href="#pets">Find a pet</a></div>}
      {status.type === 'ready' && requests.length > 0 && <div className="request-list">{requests.map((item) => <article className="request-card" key={item.id}><div><h2>{item.petName || `Pet #${item.petId}`}</h2><p>Submitted {new Date(item.createdAt).toLocaleDateString()}</p></div><span className={`status-badge status-${item.status}`}>{item.status}</span><p>{item.message}</p></article>)}</div>}
    </section>
  );
}
