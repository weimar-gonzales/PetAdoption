const speciesOptions = [
  ['dog', 'Dogs'],
  ['cat', 'Cats'],
  ['rabbit', 'Rabbits'],
  ['bird', 'Birds'],
  ['other', 'Other'],
];

export function SearchFilters({ filters, onChange, onSubmit, onReset }) {
  const update = (event) => onChange({ ...filters, [event.target.name]: event.target.value });

  return (
    <form className="filters" onSubmit={onSubmit} aria-label="Find a pet">
      <div className="search-field">
        <label htmlFor="search">Search by name, breed, or description</label>
        <input
          id="search"
          name="search"
          type="search"
          value={filters.search}
          onChange={update}
          placeholder="Try “Luna” or “gentle”"
        />
      </div>
      <div>
        <label htmlFor="species">Species</label>
        <select id="species" name="species" value={filters.species} onChange={update}>
          <option value="">All species</option>
          {speciesOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="size">Size</label>
        <select id="size" name="size" value={filters.size} onChange={update}>
          <option value="">Any size</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      <div>
        <label htmlFor="status">Status</label>
        <select id="status" name="status" value={filters.status} onChange={update}>
          <option value="">Any status</option>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="adopted">Adopted</option>
        </select>
      </div>
      <div className="filter-actions">
        <button className="button button-primary" type="submit">Search pets</button>
        <button className="button button-quiet" type="button" onClick={onReset}>Clear</button>
      </div>
    </form>
  );
}
