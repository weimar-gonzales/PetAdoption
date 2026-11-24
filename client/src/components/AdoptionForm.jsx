import { useEffect, useState } from 'react';

const validate = (values) => {
  const errors = {};
  if (!values.message.trim()) errors.message = 'Please tell us why you would be a good match.';
  else if (values.message.trim().length > 5000) errors.message = 'Message must be 5000 characters or fewer.';
  if (!values.user.phone || values.user.phone.trim().length < 7) errors.profile = 'Add a phone number to your profile before applying.';
  return errors;
};

export function AdoptionForm({ petId, petName, user, onSubmit, status }) {
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  useEffect(() => { setMessage(''); setErrors({}); }, [petId]);
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate({ message, user });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit({ petId, message });
  };
  return (
    <form className="adoption-form" onSubmit={submit} noValidate>
      <div className="form-heading"><h3>Apply to adopt {petName}</h3><p>Your profile details will be shared with our adoption team.</p></div>
      <div className="profile-summary"><strong>{user.name}</strong><span>{user.email}</span>{user.phone && <span>{user.phone}</span>}</div>
      <div className="form-field form-field-wide"><label htmlFor="message">Why would you be a good match?</label><textarea id="message" name="message" rows="4" value={message} onChange={(event) => { setMessage(event.target.value); setErrors({}); }} maxLength="5000" aria-invalid={Boolean(errors.message || errors.profile)} aria-describedby={errors.message ? 'message-error' : errors.profile ? 'profile-error' : undefined} />{errors.message && <span className="field-error" id="message-error">{errors.message}</span>}{errors.profile && <span className="field-error" id="profile-error">{errors.profile}</span>}</div>
      <button className="button button-primary" type="submit" disabled={status?.type === 'submitting'}>{status?.type === 'submitting' ? 'Sending application…' : 'Send application'}</button>
      {status?.type === 'success' && <p className="form-feedback success" role="status">{status.message}</p>}
      {status?.type === 'error' && <p className="form-feedback error" role="alert">{status.message}</p>}
    </form>
  );
}
