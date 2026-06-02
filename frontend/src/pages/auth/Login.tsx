import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { LogIn } from 'lucide-react';
import { GoogleLoginButton } from '../../components/GoogleLoginButton';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string, email?: string) => {
    setError('');
    setLoading(true);
    try {
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
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-danger p-3 rounded-md text-sm">
            {error}
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
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-text-primary">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Signing in...' : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </>
          )}
        </button>
        
        <div className="text-sm text-center">
          <Link to="/register" className="font-medium text-secondary hover:text-primary">
            Create a new company account
          </Link>
        </div>
      </form>
      
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-text-secondary">Or continue with</span>
          </div>
        </div>
        
        <div className="mt-6">
          <GoogleLoginButton onSuccess={handleGoogleSuccess} />
        </div>
      </div>
    </div>
  );
}
