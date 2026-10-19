import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './App.jsx';

describe('account access', () => {
  test('submits credentials and passes the authenticated session to the app', async () => {
    const user = userEvent.setup();
    const onAuthenticated = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'signed-token', user: { id: 'u1', displayName: 'Mira', email: 'mira@example.test' } })
    });

    render(<AuthScreen onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText('Email address'), 'mira@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-7');
    await user.click(screen.getByRole('button', { name: /^sign in →$/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith({
      token: 'signed-token', user: { id: 'u1', displayName: 'Mira', email: 'mira@example.test' }
    }));
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));
  });

  test('shows the account creation fields when switching modes', async () => {
    const user = userEvent.setup();
    render(<AuthScreen onAuthenticated={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('heading', { name: 'Make it yours.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8');
  });
});
