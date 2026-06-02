import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { GoogleLoginButton } from '../../components/GoogleLoginButton';

export function SetupPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Invalid invite link: Missing token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/setup-password', { token, password });
      setMessage(response.data.message);
      // Wait a moment then log the user in automatically
      setTimeout(() => {
        login(response.data.token, response.data.user);
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to configure password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string, email?: string) => {
    setError('');
    setLoading(true);
    try {
      // For Google login we send email if it's the mock credential
      const response = await api.post('/auth/google', { credential, email });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-center text-xl font-bold text-text-primary mb-2">Configure Your Account</h2>
      <p className="text-center text-sm text-text-secondary mb-6">
        Complete your onboarding by setting a password or signing in with Google.
      </p>
      
      {!token ? (
        <div className="text-center bg-red-50 text-danger p-3 rounded-md text-sm">
          Invalid or expired invitation link. Please request a new invite from your administrator.
        </div>
      ) : (
        <div className="space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-danger p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {message && (
              <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
                {message} Redirecting to dashboard...
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary">Password</label>
              <input
                type="password"
                required
                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading || !!message}
              />
              <p className="mt-1 text-xs text-text-secondary">Minimum 8 characters, at least 1 letter and 1 number.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">Confirm Password</label>
              <input
                type="password"
                required
                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading || !!message}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!message}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? 'Configuring...' : 'Set Password'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-text-secondary">Or link account with</span>
            </div>
          </div>

          <GoogleLoginButton onSuccess={handleGoogleSuccess} buttonText="Link Google Account" />
        </div>
      )}
    </div>
  );
}
