import { useState } from 'react';

const registerInitial = { name: '', email: '', password: '', phone: '', address: '' };
const loginInitial = { email: '', password: '' };

const validate = (values, mode) => {
  const errors = {};
  if (mode === 'register' && !values.name.trim()) errors.name = 'Please enter your name.';
  if (mode === 'register' && values.name.trim().length > 150) errors.name = 'Name must be 150 characters or fewer.';
  if (!values.email.trim()) errors.email = 'Please enter your email address.';
  else if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = 'Please enter a valid email address.';
  if (!values.password) errors.password = 'Please enter a password.';
  else if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (values.password.length > 128) errors.password = 'Password must be 128 characters or fewer.';
  if (mode === 'register' && values.phone.trim() && (values.phone.trim().length < 7 || values.phone.trim().length > 30)) errors.phone = 'Phone must be between 7 and 30 characters.';
  if (mode === 'register' && values.address.trim().length > 500) errors.address = 'Address must be 500 characters or fewer.';
  return errors;
};

export function AuthPage({ mode, onSubmit, onNavigate, status }) {
  const isRegister = mode === 'register';
  const [values, setValues] = useState(isRegister ? registerInitial : loginInitial);
  const [errors, setErrors] = useState({});
  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit(isRegister ? { ...values, phone: values.phone || undefined, address: values.address || undefined } : values);
  };
  const fieldError = (name) => errors[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;

  return (
    <section className="page-section auth-page" aria-labelledby="auth-title">
      <p className="eyebrow">A safe start for every match</p>
      <h1 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="page-intro">{isRegister ? 'Create a profile to register pets and apply to adopt.' : 'Sign in to manage your profile and adoption applications.'}</p>
      <form className="account-form" onSubmit={submit} noValidate>
        {isRegister && <div className="form-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" value={values.name} onChange={update} maxLength="150" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} />{fieldError('name')}</div>}
        <div className="form-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" value={values.email} onChange={update} maxLength="254" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />{fieldError('email')}</div>
        <div className="form-field"><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" value={values.password} onChange={update} maxLength="128" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} />{fieldError('password')}</div>
        {isRegister && <>
          <div className="form-field"><label htmlFor="auth-phone">Phone (optional)</label><input id="auth-phone" name="phone" type="tel" value={values.phone} onChange={update} maxLength="30" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} />{fieldError('phone')}</div>
          <div className="form-field"><label htmlFor="auth-address">Address (optional)</label><textarea id="auth-address" name="address" rows="3" value={values.address} onChange={update} maxLength="500" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'address-error' : undefined} />{fieldError('address')}</div>
        </>}
        <button className="button button-primary" type="submit" disabled={status?.type === 'submitting'}>{status?.type === 'submitting' ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        {status?.type === 'error' && <p className="form-feedback error" role="alert">{status.message}</p>}
      </form>
      <p className="page-switch">{isRegister ? 'Already have an account?' : 'New to Home for Paws?'} <a href={isRegister ? '#login' : '#register'} onClick={(event) => { event.preventDefault(); onNavigate(isRegister ? 'login' : 'register'); }}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
    </section>
  );
}
