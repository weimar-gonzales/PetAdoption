import { useEffect, useRef, useState } from 'react';

const fallbackImage = 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=900&q=80';
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PetDetails({ pet, onClose, onAdopt, children }) {
  const [image, setImage] = useState(pet.imageUrl || fallbackImage);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(focusableSelector);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="pet-dialog-title">
        <button ref={closeRef} className="dialog-close" type="button" onClick={onClose} aria-label="Close pet details">×</button>
        <img className="pet-detail-image" src={image} alt={`${pet.name}, ${pet.breed}`} onError={() => setImage(fallbackImage)} />
        <div className="dialog-intro"><p className="eyebrow">Meet your new companion</p><h2 id="pet-dialog-title">{pet.name}</h2><p className="pet-meta">{pet.breed} · {pet.age} {pet.age === 1 ? 'year' : 'years'} old · {pet.size}</p><p>{pet.description}</p></div>
        {pet.status === 'available' ? <><button className="button button-primary" type="button" onClick={onAdopt}>Apply to adopt {pet.name}</button>{children}</> : <p className="notice">{pet.name} is not currently available for adoption.</p>}
      </section>
    </div>
  );
}
