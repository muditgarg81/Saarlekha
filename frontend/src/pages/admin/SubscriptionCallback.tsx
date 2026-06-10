import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

export function SubscriptionCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('Verifying payment link status...');

  useEffect(() => {
    const verifyLink = async () => {
      const linkId = searchParams.get('razorpay_payment_link_id') || searchParams.get('razorpay_payment_id');
      const linkStatus = searchParams.get('razorpay_payment_link_status') || 'paid';
      const companyId = searchParams.get('companyId');
      const tier = searchParams.get('tier');

      if (!linkId) {
        setStatus('failed');
        setMessage('Missing transaction reference parameters.');
        return;
      }

      try {
        const res = await api.get('/payments/verify-link', {
          params: {
            razorpay_payment_link_id: linkId,
            razorpay_payment_link_status: linkStatus,
            companyId,
            tier
          }
        });

        if (res.data.success) {
          setStatus('success');
          setMessage(`Payment verified successfully! Your company subscription has been upgraded to ${res.data.tier} tier.`);
          setTimeout(() => {
            navigate('/subscription');
          }, 4000);
        } else {
          setStatus('failed');
          setMessage('Payment link verification indicated status is: ' + res.data.status);
        }
      } catch (err: any) {
        setStatus('failed');
        setMessage(err.response?.data?.error || 'Verification request failed.');
      }
    };

    verifyLink();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-card border border-border shadow-md max-w-md w-full text-center space-y-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <h3 className="text-lg font-bold text-text-primary">Verifying Transaction</h3>
            <p className="text-xs text-text-secondary">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600">
              <ShieldCheck className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-bold text-emerald-700">Payment Successful!</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{message}</p>
            <p className="text-[10px] text-gray-400 pt-2">Redirecting to subscription settings in a few seconds...</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 bg-red-50 border border-red-100 rounded-full text-danger">
              <ShieldAlert className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-bold text-danger">Verification Failed</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{message}</p>
            <button
              onClick={() => navigate('/subscription')}
              className="mt-4 bg-primary text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-primary-light shadow-sm transition-all"
            >
              Back to Subscriptions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
