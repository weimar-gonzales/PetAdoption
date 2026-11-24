import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, getPets, loginUser, logoutUser, registerUser, submitAdoption } from './api.js';
import { AdoptionForm } from './components/AdoptionForm.jsx';
import { AdoptionRequestsPage } from './components/AdoptionRequestsPage.jsx';
import { AuthPage } from './components/AuthPage.jsx';
import { PetCard } from './components/PetCard.jsx';
import { PetDetails } from './components/PetDetails.jsx';
import { PetRegistrationPage } from './components/PetRegistrationPage.jsx';
import { ProfilePage } from './components/ProfilePage.jsx';
import { SearchFilters } from './components/SearchFilters.jsx';

const defaultFilters = { search: '', species: '', size: '', status: 'available' };

function Header({ user, onNavigate, onLogout }) {
  return (
    <header className="site-header">
      <a className="brand" href="#pets" aria-label="Home for Paws home" onClick={(event) => { event.preventDefault(); onNavigate('pets'); }}><span className="brand-mark" aria-hidden="true">♥</span><span>Home for Paws</span></a>
      <nav aria-label="Main navigation"><a href="#pets" onClick={(event) => { event.preventDefault(); onNavigate('pets'); }}>Find a pet</a><a href="#how-it-works">How it works</a>{user ? <><a href="#profile" onClick={(event) => { event.preventDefault(); onNavigate('profile'); }}>Profile</a><a href="#register-pet" onClick={(event) => { event.preventDefault(); onNavigate('register-pet'); }}>Register a pet</a><a href="#my-adoptions" onClick={(event) => { event.preventDefault(); onNavigate('my-adoptions'); }}>My adoptions</a><button className="nav-button" type="button" onClick={onLogout}>Sign out</button></> : <><a href="#login" onClick={(event) => { event.preventDefault(); onNavigate('login'); }}>Sign in</a><a href="#register" onClick={(event) => { event.preventDefault(); onNavigate('register'); }}>Register</a></>}</nav>
    </header>
  );
}

function PublicListing({ filters, setFilters, pets, loading, error, loadPets, submitFilters, resetFilters, onSelect }) {
  return <>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">Every pet deserves a loving home</p><h1 id="hero-title">Find your new best friend.</h1><p className="hero-text">Meet wonderful pets waiting for a family just like yours. Start your search and take the first step toward a lifelong connection.</p><a className="button button-primary hero-button" href="#pets">Browse available pets</a></div><div className="hero-art" aria-hidden="true"><span>🐶</span><span>🐱</span><span>🐰</span></div></section>
    <section className="listing-section" id="pets" aria-labelledby="pets-title"><div className="section-heading"><div><p className="eyebrow">Make a connection</p><h2 id="pets-title">Pets looking for a home</h2></div><p className="section-description">Use the filters to find a companion who fits your life.</p></div><SearchFilters filters={filters} onChange={setFilters} onSubmit={submitFilters} onReset={resetFilters} /><div className="listing-status" aria-live="polite">{loading && <p className="loading-message">Finding pets for you…</p>}{!loading && error && <div className="state-panel error-panel" role="alert"><h3>We couldn't load the pets</h3><p>{error}</p><button className="button button-secondary" type="button" onClick={() => loadPets(filters)}>Try again</button></div>}{!loading && !error && pets.length === 0 && <div className="state-panel"><h3>No pets found</h3><p>Try broadening your search or clearing the filters.</p></div>}</div>{!loading && !error && pets.length > 0 && <div className="pet-grid">{pets.map((pet) => <PetCard key={pet.id} pet={pet} onSelect={onSelect} />)}</div>}</section>
    <section className="how-it-works" id="how-it-works" aria-labelledby="how-title"><p className="eyebrow">A simple start</p><h2 id="how-title">Adoption made thoughtful</h2><div className="steps"><div><span>01</span><h3>Get to know a pet</h3><p>Browse profiles and learn what makes each pet special.</p></div><div><span>02</span><h3>Send an application</h3><p>Share a little about your home and your hopes for a companion.</p></div><div><span>03</span><h3>Meet your match</h3><p>Our team will help you take the next step with confidence.</p></div></div></section>
  </>;
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || 'pets');
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPet, setSelectedPet] = useState(null);
  const [showApplication, setShowApplication] = useState(false);
  const [adoptionStatus, setAdoptionStatus] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [requestRefresh, setRequestRefresh] = useState(0);

  const navigate = useCallback((nextRoute) => { window.location.hash = nextRoute; setRoute(nextRoute); }, []);
  useEffect(() => { const handleHash = () => setRoute(window.location.hash.slice(1) || 'pets'); window.addEventListener('hashchange', handleHash); return () => window.removeEventListener('hashchange', handleHash); }, []);
  useEffect(() => { getCurrentUser().then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null)); }, []);

  const loadPets = useCallback(async (nextFilters) => { setLoading(true); setError(''); try { const result = await getPets(nextFilters); setPets(result.pets || []); } catch (requestError) { setPets([]); setError(requestError.message); } finally { setLoading(false); } }, []);
  useEffect(() => { loadPets(defaultFilters); }, [loadPets]);

  const selectPet = (pet) => { setSelectedPet(pet); setShowApplication(false); setAdoptionStatus(null); };
  const closeDetails = useCallback(() => { setSelectedPet(null); setShowApplication(false); setAdoptionStatus(null); }, []);
  const applyForPet = () => { if (!user) { closeDetails(); navigate('login'); return; } setShowApplication(true); setAdoptionStatus(null); };
  const handleAdoption = async (values) => { setAdoptionStatus({ type: 'submitting' }); try { await submitAdoption(values); setAdoptionStatus({ type: 'success', message: 'Thank you. Your application has been sent, and our team will contact you soon.' }); setRequestRefresh((value) => value + 1); } catch (requestError) { setAdoptionStatus({ type: 'error', message: requestError.message }); } };
  const submitFilters = (event) => { event.preventDefault(); loadPets(filters); };
  const resetFilters = () => { setFilters(defaultFilters); loadPets(defaultFilters); };
  const handleAuth = async (values, mode) => { setAuthStatus({ type: 'submitting' }); try { const result = mode === 'register' ? await registerUser(values) : await loginUser(values); setUser(result.user); setAuthStatus(null); navigate('pets'); } catch (requestError) { setAuthStatus({ type: 'error', message: requestError.message }); } };
  const handleLogout = async () => { try { await logoutUser(); } finally { setUser(null); navigate('pets'); } };

  const page = route === 'register' || route === 'login' ? <AuthPage mode={route} onSubmit={(values) => handleAuth(values, route)} onNavigate={navigate} status={authStatus} />
    : route === 'profile' && user ? <ProfilePage user={user} onUserChange={setUser} />
      : route === 'register-pet' && user ? <PetRegistrationPage onNavigate={navigate} />
        : route === 'my-adoptions' && user ? <AdoptionRequestsPage refreshKey={requestRefresh} />
          : <PublicListing filters={filters} setFilters={setFilters} pets={pets} loading={loading} error={error} loadPets={loadPets} submitFilters={submitFilters} resetFilters={resetFilters} onSelect={selectPet} />;

  return <div className="app-shell"><Header user={user} onNavigate={navigate} onLogout={handleLogout} /><main>{page}</main><footer><span>Home for Paws</span><span>Built with care for pets and people.</span></footer>{selectedPet && <PetDetails pet={selectedPet} onClose={closeDetails} onAdopt={applyForPet}>{showApplication && user && <AdoptionForm petId={selectedPet.id} petName={selectedPet.name} user={user} onSubmit={handleAdoption} status={adoptionStatus} />}</PetDetails>}</div>;
}
