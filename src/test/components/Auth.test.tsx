import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';

// Mock components for testing
const MockLogin = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Mock login validation
    if (!email || !password) {
      alert('Email and password are required');
      return;
    }

    if (!email.includes('@')) {
      alert('Invalid email format');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    // Mock successful login
    alert('Login successful');
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form" noValidate>
      <input name="email" type="email" placeholder="Email" data-testid="email-input" />
      <input name="password" type="password" placeholder="Password" data-testid="password-input" />
      <button type="submit" data-testid="login-button">
        Log In
      </button>
    </form>
  );
};

const MockSignUp = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    // Mock signup validation
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      alert('All fields are required');
      return;
    }

    if (!email.includes('@')) {
      alert('Invalid email format');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Mock successful signup
    alert('Account created successfully');
  };

  return (
    <form onSubmit={handleSubmit} data-testid="signup-form" noValidate>
      <input name="firstName" type="text" placeholder="First Name" data-testid="firstName-input" />
      <input name="lastName" type="text" placeholder="Last Name" data-testid="lastName-input" />
      <input name="email" type="email" placeholder="Email" data-testid="email-input" />
      <input name="password" type="password" placeholder="Password" data-testid="password-input" />
      <input
        name="confirmPassword"
        type="password"
        placeholder="Confirm Password"
        data-testid="confirm-password-input"
      />
      <button type="submit" data-testid="signup-button">
        Create Account
      </button>
    </form>
  );
};

const MockProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Mock authentication check
  const isAuthenticated = false; // Mock unauthenticated state

  if (!isAuthenticated) {
    return <div data-testid="login-required">Please log in to access this page</div>;
  }

  return <>{children}</>;
};

const MockAdminRoute = ({ children }: { children: React.ReactNode }) => {
  // Mock admin check
  const isAdmin = false; // Mock non-admin state

  if (!isAdmin) {
    return <div data-testid="admin-required">Admin access required</div>;
  }

  return <>{children}</>;
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe('Authentication Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Component', () => {
    it('renders login form', () => {
      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-button')).toBeInTheDocument();
    });

    it('shows validation error for empty fields', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      const loginButton = screen.getByTestId('login-button');
      await user.click(loginButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Email and password are required');
      });
    });

    it('shows validation error for invalid email', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('email-input'), 'invalid-email');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Invalid email format');
      });
    });

    it('shows validation error for short password', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), '123');
      await user.click(screen.getByTestId('login-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Password must be at least 6 characters');
      });
    });

    it('submits form with valid credentials', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Login successful');
      });
    });

    it('handles form submission with Enter key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockLogin />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Login successful');
      });
    });
  });

  describe('Sign Up Component', () => {
    it('renders signup form', () => {
      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      expect(screen.getByTestId('signup-form')).toBeInTheDocument();
      expect(screen.getByTestId('firstName-input')).toBeInTheDocument();
      expect(screen.getByTestId('lastName-input')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('signup-button')).toBeInTheDocument();
    });

    it('shows validation error for empty fields', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('All fields are required');
      });
    });

    it('shows validation error for invalid email', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'invalid-email');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.type(screen.getByTestId('confirm-password-input'), 'password123');
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Invalid email format');
      });
    });

    it('shows validation error for short password', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), '123');
      await user.type(screen.getByTestId('confirm-password-input'), '123');
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Password must be at least 8 characters');
      });
    });

    it('shows validation error for password mismatch', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.type(screen.getByTestId('confirm-password-input'), 'different123');
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Passwords do not match');
      });
    });

    it('submits form with valid data', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.type(screen.getByTestId('confirm-password-input'), 'password123');
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Account created successfully');
      });
    });
  });

  describe('Protected Routes', () => {
    it('shows login required message for unauthenticated users', () => {
      render(
        <TestWrapper>
          <MockProtectedRoute>
            <div>Protected content</div>
          </MockProtectedRoute>
        </TestWrapper>,
      );

      expect(screen.getByTestId('login-required')).toBeInTheDocument();
      expect(screen.getByText('Please log in to access this page')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('shows admin required message for non-admin users', () => {
      render(
        <TestWrapper>
          <MockAdminRoute>
            <div>Admin content</div>
          </MockAdminRoute>
        </TestWrapper>,
      );

      expect(screen.getByTestId('admin-required')).toBeInTheDocument();
      expect(screen.getByText('Admin access required')).toBeInTheDocument();
      expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    });
  });

  describe('Password Strength', () => {
    it('accepts strong password', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      const strongPassword = 'StrongP@ss123!';

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), strongPassword);
      await user.type(screen.getByTestId('confirm-password-input'), strongPassword);
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Account created successfully');
      });
    });

    it('handles special characters in password', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MockSignUp />
        </TestWrapper>,
      );

      const specialPassword = 'Pass@#$%123';

      await user.type(screen.getByTestId('firstName-input'), 'John');
      await user.type(screen.getByTestId('lastName-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), specialPassword);
      await user.type(screen.getByTestId('confirm-password-input'), specialPassword);
      await user.click(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Account created successfully');
      });
    });
  });

  describe('Email Validation Edge Cases', () => {
    it('accepts valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        '123@test.com',
      ];

      for (const email of validEmails) {
        cleanup();
        const user = userEvent.setup();

        render(
          <TestWrapper>
            <MockLogin />
          </TestWrapper>,
        );

        await user.type(screen.getByTestId('email-input'), email);
        await user.type(screen.getByTestId('password-input'), 'password123');
        await user.click(screen.getByTestId('login-button'));

        await waitFor(() => {
          expect(window.alert).toHaveBeenCalledWith('Login successful');
        });
      }
    });

    it('rejects invalid email formats', async () => {
      const invalidEmails = [
        'invalid',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
      ].filter(email => email.length > 0);

      for (const email of invalidEmails) {
        cleanup();
        const user = userEvent.setup();

        render(
          <TestWrapper>
            <MockLogin />
          </TestWrapper>,
        );

        await user.type(screen.getByTestId('email-input'), email);
        await user.type(screen.getByTestId('password-input'), 'password123');
        await user.click(screen.getByTestId('login-button'));

        await waitFor(() => {
          expect(window.alert).toHaveBeenCalledWith('Invalid email format');
        });
      }
    });
  });
});

// Mock window.alert for testing
beforeEach(() => {
  vi.stubGlobal('alert', vi.fn());
});
