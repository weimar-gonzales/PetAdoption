import { useEffect, useRef, useState } from 'react';
import { createPet, updatePet } from '../api.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const initialValues = { name: '', species: 'dog', breed: '', age: '0', gender: 'unknown', size: 'medium', description: '', imageUrl: '' };
const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Please enter a pet name.';
  if (!values.breed.trim()) errors.breed = 'Please enter a breed.';
  if (!Number.isInteger(Number(values.age)) || Number(values.age) < 0 || Number(values.age) > 100) errors.age = 'Age must be a whole number from 0 to 100.';
  if (!values.description.trim()) errors.description = 'Please describe the pet.';
  if (values.imageUrl && !/^https?:\/\//.test(values.imageUrl)) errors.imageUrl = 'Image URL must start with http:// or https://.';
  return errors;
};

const imageError = (file) => {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'Choose a JPEG, PNG, GIF, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'The image must be 5 MiB or smaller.';
  return '';
};

export function PetRegistrationPage({ pet, onNavigate }) {
  const [values, setValues] = useState(pet ? { ...pet, age: String(pet.age), imageUrl: pet.imageUrl?.startsWith('http') ? pet.imageUrl : '' } : initialValues);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(pet?.imageUrl || '');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const formRef = useRef(null);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const update = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: undefined }));
    setStatus(null);
  };

  const updateImage = (event) => {
    const file = event.target.files?.[0];
    setStatus(null);
    if (!file) {
      setImageFile(null);
      setPreviewUrl(pet?.imageUrl || '');
      setErrors((current) => ({ ...current, image: undefined }));
      return;
    }
    const error = imageError(file);
    if (error) {
      setImageFile(null);
      setErrors((current) => ({ ...current, image: error }));
      return;
    }
    setImageFile(file);
    setErrors((current) => ({ ...current, image: undefined }));
    setPreviewUrl(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    if (errors.image) nextErrors.image = errors.image;
    setErrors(nextErrors);
    setStatus(null);
    if (Object.keys(nextErrors).length || (imageFile && imageError(imageFile))) return;
    setStatus({ type: 'submitting' });
    const input = { ...values, age: Number(values.age) };
    if (pet) {
      if (values.imageUrl) input.imageUrl = values.imageUrl;
      else delete input.imageUrl;
    } else {
      input.imageUrl = values.imageUrl || null;
    }
    try {
      if (pet) {
        await (imageFile ? updatePet(pet.id, input, imageFile) : updatePet(pet.id, input));
      } else {
        await (imageFile ? createPet(input, imageFile) : createPet(input));
      }
      setStatus({ type: 'success', message: pet ? 'Your pet has been updated.' : 'Your pet has been registered.' });
      if (!pet) {
        setValues(initialValues);
        setImageFile(null);
        setPreviewUrl('');
        formRef.current?.reset();
      }
    } catch (error) {
      const serverErrors = {};
      for (const detail of error.details || []) {
        const field = detail.path?.[0];
        if (field) serverErrors[field] = detail.message;
      }
      setErrors(serverErrors);
      setStatus({ type: 'error', message: error.message });
    }
  };

  const fieldError = (name) => errors[name] ? <span className="field-error" id={`pet-${name}-error`}>{errors[name]}</span> : null;
  return (
    <section className="page-section" aria-labelledby="pet-registration-title">
      <p className="eyebrow">Care starts here</p><h1 id="pet-registration-title">{pet ? 'Edit your pet' : 'Register a pet'}</h1><p className="page-intro">Share the details adopters need to find the right companion.</p>
      <form ref={formRef} className="account-form pet-form" onSubmit={submit} noValidate>
        <div className="form-field"><label htmlFor="pet-name">Pet name</label><input id="pet-name" name="name" value={values.name} onChange={update} maxLength="100" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'pet-name-error' : undefined} />{fieldError('name')}</div>
        <div className="form-field"><label htmlFor="pet-species">Species</label><select id="pet-species" name="species" value={values.species} onChange={update}><option value="dog">Dog</option><option value="cat">Cat</option><option value="rabbit">Rabbit</option><option value="bird">Bird</option><option value="other">Other</option></select></div>
        <div className="form-field"><label htmlFor="pet-breed">Breed</label><input id="pet-breed" name="breed" value={values.breed} onChange={update} maxLength="100" aria-invalid={Boolean(errors.breed)} aria-describedby={errors.breed ? 'pet-breed-error' : undefined} />{fieldError('breed')}</div>
        <div className="form-field"><label htmlFor="pet-age">Age</label><input id="pet-age" name="age" type="number" min="0" max="100" value={values.age} onChange={update} aria-invalid={Boolean(errors.age)} aria-describedby={errors.age ? 'pet-age-error' : undefined} />{fieldError('age')}</div>
        <div className="form-field"><label htmlFor="pet-gender">Gender</label><select id="pet-gender" name="gender" value={values.gender} onChange={update}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></div>
        <div className="form-field"><label htmlFor="pet-size">Size</label><select id="pet-size" name="size" value={values.size} onChange={update}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
        <div className="form-field form-field-wide"><label htmlFor="pet-image">Pet image (optional)</label><input id="pet-image" name="image" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={updateImage} aria-invalid={Boolean(errors.image)} aria-describedby={errors.image ? 'pet-image-error' : 'pet-image-help'} />{errors.image ? fieldError('image') : <span className="field-help" id="pet-image-help">JPEG, PNG, GIF, or WebP. Maximum 5 MiB.</span>}{previewUrl && <img className="pet-image-preview" src={previewUrl} alt="Pet preview" />}</div>
        <div className="form-field form-field-wide"><label htmlFor="pet-description">Description</label><textarea id="pet-description" name="description" rows="5" value={values.description} onChange={update} maxLength="5000" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'pet-description-error' : undefined} />{fieldError('description')}</div>
        <div className="form-actions"><button className="button button-primary" type="submit" disabled={status?.type === 'submitting'}>{status?.type === 'submitting' ? 'Saving…' : pet ? 'Save pet' : 'Register pet'}</button>{pet && <button className="button button-quiet" type="button" onClick={() => onNavigate('pets')}>Cancel</button>}</div>
        {status?.type === 'success' && <p className="form-feedback success" role="status">{status.message}</p>}
        {status?.type === 'error' && <p className="form-feedback error" role="alert">{status.message}</p>}
      </form>
    </section>
  );
}
