import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request password reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-center text-xl font-bold text-text-primary mb-6">Reset Your Password</h2>
      
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-danger p-3 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
            {message}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary">Email address</label>
          <input
            type="email"
            required
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading || !!message}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !!message}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
        
        <div className="text-sm text-center">
          <Link to="/login" className="font-medium text-secondary hover:text-primary">
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
