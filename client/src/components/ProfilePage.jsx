import { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '../api.js';

const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Please enter your name.';
  if (values.name.trim().length > 150) errors.name = 'Name must be 150 characters or fewer.';
  if (values.phone.trim() && (values.phone.trim().length < 7 || values.phone.trim().length > 30)) errors.phone = 'Phone must be between 7 and 30 characters.';
  if (values.address.trim().length > 500) errors.address = 'Address must be 500 characters or fewer.';
  return errors;
};

export function ProfilePage({ user, onUserChange }) {
  const [values, setValues] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(!user);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    if (!user) {
      getProfile().then(({ user: profile }) => {
        if (active) { setValues({ name: profile.name || '', phone: profile.phone || '', address: profile.address || '' }); onUserChange(profile); }
      }).catch((error) => active && setStatus({ type: 'error', message: error.message })).finally(() => active && setLoading(false));
    }
    return () => { active = false; };
  }, [onUserChange, user]);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setStatus(null);
    if (Object.keys(nextErrors).length) return;
    setStatus({ type: 'submitting' });
    try {
      const result = await updateProfile({ name: values.name, phone: values.phone || null, address: values.address || null });
      setValues({ name: result.user.name || '', phone: result.user.phone || '', address: result.user.address || '' });
      onUserChange(result.user);
      setStatus({ type: 'success', message: 'Your profile has been updated.' });
    } catch (error) { setStatus({ type: 'error', message: error.message }); }
  };
  const update = (event) => { setValues((current) => ({ ...current, [event.target.name]: event.target.value })); setErrors((current) => ({ ...current, [event.target.name]: undefined })); };
  const fieldError = (name) => errors[name] ? <span className="field-error" id={`profile-${name}-error`}>{errors[name]}</span> : null;

  if (loading) return <section className="page-section"><p className="loading-message">Loading your profile…</p></section>;
  return (
    <section className="page-section" aria-labelledby="profile-title">
      <p className="eyebrow">Your account</p><h1 id="profile-title">Edit your profile</h1><p className="page-intro">Keep your contact details current for adoption conversations.</p>
      <form className="account-form" onSubmit={submit} noValidate>
        <div className="form-field"><label htmlFor="profile-email">Email address</label><input id="profile-email" value={user?.email || ''} readOnly /></div>
        <div className="form-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" name="name" value={values.name} onChange={update} maxLength="150" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'profile-name-error' : undefined} />{fieldError('name')}</div>
        <div className="form-field"><label htmlFor="profile-phone">Phone</label><input id="profile-phone" name="phone" type="tel" value={values.phone} onChange={update} maxLength="30" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'profile-phone-error' : undefined} />{fieldError('phone')}</div>
        <div className="form-field"><label htmlFor="profile-address">Address</label><textarea id="profile-address" name="address" rows="3" value={values.address} onChange={update} maxLength="500" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'profile-address-error' : undefined} />{fieldError('address')}</div>
        <button className="button button-primary" type="submit" disabled={status?.type === 'submitting'}>{status?.type === 'submitting' ? 'Saving…' : 'Save profile'}</button>
        {status?.type === 'success' && <p className="form-feedback success" role="status">{status.message}</p>}
        {status?.type === 'error' && <p className="form-feedback error" role="alert">{status.message}</p>}
      </form>
    </section>
  );
}
