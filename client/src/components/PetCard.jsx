import { useState } from 'react';

const fallbackImage = 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=900&q=80';

export function PetCard({ pet, onSelect }) {
  const [image, setImage] = useState(pet.imageUrl || fallbackImage);
  const statusLabel = pet.status.charAt(0).toUpperCase() + pet.status.slice(1);

  return (
    <article className="pet-card">
      <div className="pet-card-image-wrap">
        <img
          className="pet-card-image"
          src={image}
          alt={`${pet.name}, ${pet.breed}`}
          onError={() => setImage(fallbackImage)}
        />
        <span className={`status-badge status-${pet.status}`}>{statusLabel}</span>
      </div>
      <div className="pet-card-content">
        <div className="pet-card-heading">
          <h3>{pet.name}</h3>
          <span>{pet.age} {pet.age === 1 ? 'year' : 'years'} old</span>
        </div>
        <p className="pet-meta">{pet.breed} · {pet.size} · {pet.gender}</p>
        <p className="pet-description">{pet.description}</p>
        <button className="button button-secondary" type="button" onClick={(event) => { event.currentTarget.focus(); onSelect(pet); }}>
          View {pet.name}'s profile
        </button>
      </div>
    </article>
  );
}
