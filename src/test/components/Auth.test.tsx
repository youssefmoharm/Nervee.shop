import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Auth/Login';

// Mock the auth context Login actually consumes (signIn only).
const authMock = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signIn: authMock.signIn }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login page (src/pages/Auth/Login.tsx)', () => {
  beforeEach(() => {
    authMock.signIn.mockReset();
    authMock.signIn.mockResolvedValue({ error: null });
  });

  it('renders email, password and submit controls', () => {
    renderLogin();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
  });

  it('native required validation blocks submit while fields are empty', async () => {
    const user = userEvent.setup();
    const { container } = renderLogin();

    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    // Empty form is invalid — the browser will not submit it
    expect(screen.getByTestId('login-email-input')).toBeRequired();
    expect(screen.getByTestId('login-password-input')).toBeRequired();
    expect(form!.checkValidity()).toBe(false);

    // Filling both fields makes the form submittable
    await user.type(screen.getByTestId('login-email-input'), 'user@test.com');
    await user.type(screen.getByTestId('login-password-input'), 'secret123');
    expect(form!.checkValidity()).toBe(true);
  });

  it('calls signIn with the entered credentials on submit', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByTestId('login-email-input'), 'user@test.com');
    await user.type(screen.getByTestId('login-password-input'), 'secret123');
    await user.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(authMock.signIn).toHaveBeenCalledWith('user@test.com', 'secret123');
    });
  });

  it('disables the button while signIn is pending, then renders the error and re-enables it', async () => {
    const user = userEvent.setup();

    let settle!: (value: { error: string | null }) => void;
    authMock.signIn.mockImplementation(
      () =>
        new Promise(resolve => {
          settle = resolve;
        }),
    );

    renderLogin();
    await user.type(screen.getByTestId('login-email-input'), 'user@test.com');
    await user.type(screen.getByTestId('login-password-input'), 'wrong');
    await user.click(screen.getByTestId('login-button'));

    // Loading state: button is disabled while the request is in flight
    await waitFor(() => {
      expect(screen.getByTestId('login-button')).toBeDisabled();
    });

    settle({ error: 'Invalid login credentials' });

    // Error string from signIn renders inline...
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
    // ...and loading clears: the button is usable again
    await waitFor(() => {
      expect(screen.getByTestId('login-button')).toBeEnabled();
    });
  });
});
