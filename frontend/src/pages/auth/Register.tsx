import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { GoogleLoginButton } from '../../components/GoogleLoginButton';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!agreed) {
      setError('You must agree to the Terms & Conditions, Privacy Policy, and Legal Terms before signing up.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', { 
        email, 
        password, 
        companyName, 
        companyAddress 
      });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string, mockEmail?: string) => {
    setError('');
    
    if (!agreed) {
      setError('You must agree to the Terms & Conditions, Privacy Policy, and Legal Terms before signing up.');
      return;
    }

    if (!companyName) {
      setError('Please fill in your Company Name before signing up with Google.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/google', { 
        credential, 
        email: mockEmail,
        companyName,
        companyAddress 
      });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-danger p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary">Company Name</label>
          <input
            type="text"
            required
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:ring-primary focus:border-primary sm:text-sm"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-primary">Company Address (Optional)</label>
          <input
            type="text"
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:ring-primary focus:border-primary sm:text-sm"
            value={companyAddress}
            onChange={e => setCompanyAddress(e.target.value)}
          />
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xs text-text-secondary mb-3 text-center">To complete registration, use email/password OR Google:</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-primary">Admin Email address</label>
          <input
            type="email"
            required
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:ring-primary focus:border-primary sm:text-sm"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary">Password</label>
          <input
            type="password"
            required
            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:ring-primary focus:border-primary sm:text-sm"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-secondary">Must be at least 8 chars, 1 letter, 1 number</p>
        </div>

        <div className="flex items-start bg-surface p-3.5 rounded-md border border-border shadow-inner">
          <div className="flex items-center h-5">
            <input
              id="agreed"
              name="agreed"
              type="checkbox"
              required
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="focus:ring-primary h-4 w-4 text-primary border-border rounded cursor-pointer"
            />
          </div>
          <div className="ml-3 text-xs leading-normal">
            <label htmlFor="agreed" className="font-semibold text-text-secondary select-none cursor-pointer">
              I agree to the{' '}
              <Link to="/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary underline font-bold">
                Terms & Conditions
              </Link>
              ,{' '}
              <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary underline font-bold">
                Privacy Policy
              </Link>
              , and{' '}
              <Link to="/legal-terms" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary underline font-bold">
                Legal Terms
              </Link>
              .
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Sign up with email/password'}
        </button>
        
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-text-secondary">Or</span>
          </div>
        </div>

        <div>
          <GoogleLoginButton onSuccess={handleGoogleSuccess} buttonText="Sign up with Google" />
        </div>

        <div className="text-sm text-center pt-2">
          <Link to="/login" className="font-medium text-secondary hover:text-primary">
            Already have an account? Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
