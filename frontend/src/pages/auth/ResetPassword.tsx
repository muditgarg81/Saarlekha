import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
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
      setError('Invalid reset link: Missing token.');
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
      const response = await api.post('/auth/reset-password', { token, password });
      setMessage(response.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-center text-xl font-bold text-text-primary mb-6">Choose New Password</h2>
      
      {!token ? (
        <div className="text-center">
          <div className="bg-red-50 text-danger p-3 rounded-md text-sm mb-4">
            Invalid or missing password reset token.
          </div>
          <Link to="/login" className="text-primary hover:underline text-sm">Back to Login</Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-danger p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
              {message} Redirecting to login...
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary">New Password</label>
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
            <label className="block text-sm font-medium text-text-primary">Confirm New Password</label>
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
            {loading ? 'Resetting...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}
