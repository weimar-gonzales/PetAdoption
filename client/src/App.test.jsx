import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { PetCard } from './components/PetCard.jsx';
import { PetDetails } from './components/PetDetails.jsx';
import { PetRegistrationPage } from './components/PetRegistrationPage.jsx';
import { createPet, getAdoptionRequests, getCurrentUser, getPets, loginUser, registerUser, submitAdoption, updateProfile } from './api.js';

vi.mock('./api.js', () => ({
  createPet: vi.fn(),
  deletePet: vi.fn(),
  getAdoptionRequests: vi.fn(),
  getCurrentUser: vi.fn(),
  getPets: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
  submitAdoption: vi.fn(),
  updatePet: vi.fn(),
  updateProfile: vi.fn(),
}));

const pets = [{ id: 1, name: 'Luna', species: 'dog', breed: 'Labrador mix', age: 3, gender: 'female', size: 'large', description: 'A friendly, energetic dog.', imageUrl: null, status: 'available' }];
const user = { id: 1, name: 'Alex Doe', email: 'alex@example.com', phone: '555-5555', address: '1 Main Street' };

const openLuna = async () => {
  expect(await screen.findByRole('heading', { name: 'Luna' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: "View Luna's profile" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = 'pets';
  getCurrentUser.mockRejectedValue(new Error('Authentication is required'));
  getPets.mockResolvedValue({ pets });
  registerUser.mockResolvedValue({ user });
  loginUser.mockResolvedValue({ user });
  submitAdoption.mockResolvedValue({ adoptionRequest: { id: 1 } });
  createPet.mockResolvedValue({ pet: { id: 2 } });
  updateProfile.mockResolvedValue({ user });
  getAdoptionRequests.mockResolvedValue({ adoptionRequests: [] });
});

afterEach(() => cleanup());

describe('pet adoption client', () => {
  it('loads and displays the initial pet listing', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeTruthy();
    expect(getPets).toHaveBeenCalledWith({ search: '', species: '', size: '', status: 'available' });
  });

  it('constructs a search and filter request from the controls', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Luna' });
    fireEvent.change(screen.getByLabelText(/search by name/i), { target: { value: 'Luna' } });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'large' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search pets' }));
    await waitFor(() => expect(getPets).toHaveBeenLastCalledWith({ search: 'Luna', species: 'dog', size: 'large', status: 'available' }));
  });

  it('requires sign-in before applying to adopt', async () => {
    render(<App />);
    await openLuna();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to adopt Luna' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
  });

  it('submits an authenticated adoption using profile details', async () => {
    getCurrentUser.mockResolvedValue({ user });
    render(<App />);
    await openLuna();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to adopt Luna' }));
    fireEvent.change(screen.getByLabelText('Why would you be a good match?'), { target: { value: 'I have a loving home.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));
    expect((await screen.findByRole('status')).textContent).toContain('Your application has been sent');
    expect(submitAdoption).toHaveBeenCalledWith({ petId: 1, message: 'I have a loving home.' });
  });

  it('shows registration and updates the session', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Register' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Doe' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(registerUser).toHaveBeenCalledWith({ name: 'Alex Doe', email: 'alex@example.com', password: 'password-123', phone: undefined, address: undefined }));
    expect(await screen.findByRole('heading', { name: 'Pets looking for a home' })).toBeTruthy();
  });

  it('renders and saves the profile form', async () => {
    getCurrentUser.mockResolvedValue({ user });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Profile' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(await screen.findByRole('heading', { name: 'Edit your profile' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ name: 'Alex Updated', phone: user.phone, address: user.address }));
  });

  it('registers a pet without accepting a client owner field', async () => {
    getCurrentUser.mockResolvedValue({ user });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Register a pet' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: 'Register a pet' }));
    fireEvent.change(screen.getByLabelText('Pet name'), { target: { value: 'Pip' } });
    fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Lionhead' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Calm rabbit' } });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'rabbit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register pet' }));
    await waitFor(() => expect(createPet).toHaveBeenCalledWith({ name: 'Pip', species: 'rabbit', breed: 'Lionhead', age: 0, gender: 'unknown', size: 'medium', description: 'Calm rabbit', imageUrl: null }));
  });

  it('registers a pet without accepting a client owner field', async () => {
    getCurrentUser.mockResolvedValue({ user });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Register a pet' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: 'Register a pet' }));
    fireEvent.change(screen.getByLabelText('Pet name'), { target: { value: 'Pip' } });
    fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Lionhead' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Calm rabbit' } });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'rabbit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register pet' }));
    await waitFor(() => expect(createPet).toHaveBeenCalledWith({ name: 'Pip', species: 'rabbit', breed: 'Lionhead', age: 0, gender: 'unknown', size: 'medium', description: 'Calm rabbit', imageUrl: null }));
  });

  it('submits a valid pet image as a separate upload file', async () => {
    render(<PetRegistrationPage onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Pet name'), { target: { value: 'Pip' } });
    fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Lionhead' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Calm rabbit' } });
    const image = new File(['valid image'], 'pip.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Pet image (optional)'), { target: { files: [image] } });
    fireEvent.click(screen.getByRole('button', { name: 'Register pet' }));
    await waitFor(() => expect(createPet).toHaveBeenCalledWith({ name: 'Pip', species: 'dog', breed: 'Lionhead', age: 0, gender: 'unknown', size: 'medium', description: 'Calm rabbit', imageUrl: null }, image));
  });

  it('rejects unsupported or oversized images before submitting', async () => {
    render(<PetRegistrationPage onNavigate={vi.fn()} />);
    const input = screen.getByLabelText('Pet image (optional)');
    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Choose a JPEG, PNG, GIF, or WebP image.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Register pet' }));
    expect(createPet).not.toHaveBeenCalled();
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByText('The image must be 5 MiB or smaller.')).toBeTruthy();
  });

  it('shows the current image while editing a pet', () => {
    render(<PetRegistrationPage pet={{ id: 4, name: 'Milo', species: 'cat', breed: 'Tabby', age: 2, gender: 'male', size: 'small', description: 'Quiet cat', imageUrl: '/uploads/pets/milo.png' }} onNavigate={vi.fn()} />);
    expect(screen.getByAltText('Pet preview').getAttribute('src')).toBe('/uploads/pets/milo.png');
  });

  it('renders the authenticated adoption history', async () => {
    getCurrentUser.mockResolvedValue({ user });
    getAdoptionRequests.mockResolvedValue({ adoptionRequests: [{ id: 1, petId: 1, status: 'pending', message: 'Please consider me.', createdAt: '2025-01-01T00:00:00.000Z' }] });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'My adoptions' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: 'My adoptions' }));
    expect(await screen.findByRole('heading', { name: 'My adoption requests' })).toBeTruthy();
    expect(await screen.findByText('Please consider me.')).toBeTruthy();
    expect(getAdoptionRequests).toHaveBeenCalled();
  });

  it('renders stored upload URLs in the listing and detail views', () => {
    const storedPet = { ...pets[0], imageUrl: '/uploads/pets/123e4567-e89b-12d3-a456-426614174000.png' };
    render(<><PetCard pet={storedPet} onSelect={vi.fn()} /><PetDetails pet={storedPet} onClose={vi.fn()} onAdopt={vi.fn()} /></>);
    expect(screen.getAllByAltText('Luna, Labrador mix').map((image) => image.getAttribute('src'))).toEqual([storedPet.imageUrl, storedPet.imageUrl]);
  });

  it('focuses, traps, closes, and restores focus for the pet dialog', async () => {
    render(<App />);
    await openLuna();
    const close = screen.getByRole('button', { name: 'Close pet details' });
    const apply = screen.getByRole('button', { name: 'Apply to adopt Luna' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(apply);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: "View Luna's profile" }));
  });
});
