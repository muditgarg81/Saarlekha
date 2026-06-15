import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Shield, Sparkles, Building2, Cpu, Users, ArrowUpRight, Copy, Check, ExternalLink, Calendar, Receipt } from 'lucide-react';
import clsx from 'clsx';

interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_link_id: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  created_at: string;
}

export function SubscriptionMaster() {
  const { user, selectedCompanyId } = useAuth();
  const [company, setCompany] = useState<any | null>(null);
  const [manpowerCount, setManpowerCount] = useState(0);
  const [machinesCount, setMachinesCount] = useState(0);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment operations state
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState<'STARTER' | 'GROWTH' | 'ENTERPRISE' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'checkout' | 'link'>('checkout');
  const [processing, setProcessing] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const fetchData = async () => {
    if (!selectedCompanyId) return;
    try {
      setLoading(true);
      // Fetch company details
      const compRes = await api.get('/companies');
      const activeComp = compRes.data.find((c: any) => c.id === selectedCompanyId);
      if (activeComp) {
        setCompany(activeComp);
      }

      // Fetch manpower count
      const manRes = await api.get('/manpower');
      setManpowerCount(manRes.data.length);

      // Fetch machines count
      const machRes = await api.get('/machines');
      setMachinesCount(machRes.data.length);

      // Fetch payment history
      const histRes = await api.get(`/payments/history/${selectedCompanyId}`);
      setHistory(histRes.data);
    } catch (error) {
      console.error('Failed to fetch subscription data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompanyId]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePurchase = async (tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE', method: 'checkout' | 'link') => {
    if (!selectedCompanyId) return;
    setProcessing(true);
    setGeneratedLink(null);

    try {
      const res = await api.post('/payments/create-order', {
        companyId: selectedCompanyId,
        tier,
        method,
        billingCycle
      });

      if (method === 'link') {
        setGeneratedLink(res.data.paymentLinkUrl);
      } else {
        // Direct checkout integration
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          alert('Failed to load Razorpay SDK. Please check your internet connection.');
          setProcessing(false);
          return;
        }

        const options = {
          key: res.data.keyId,
          amount: res.data.amount,
          currency: res.data.currency,
          name: 'SaarLekha',
          description: `${tier} Plan Subscription`,
          order_id: res.data.orderId,
          handler: async function (response: any) {
            try {
              setProcessing(true);
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                paymentId: res.data.paymentId
              });
              alert(verifyRes.data.message || 'Payment verified and subscription upgraded!');
              setSelectedUpgradeTier(null);
              fetchData();
            } catch (err: any) {
              alert(err.response?.data?.error || 'Payment verification failed');
            } finally {
              setProcessing(false);
            }
          },
          prefill: {
            name: company?.contact_name || '',
            email: company?.email || '',
            contact: company?.phone || ''
          },
          theme: {
            color: '#0059bb'
          },
          modal: {
            ondismiss: function () {
              setProcessing(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to setup payment';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-secondary">Loading subscription billing panel...</div>;
  }

  const currentTier = company?.subscription_tier || 'STARTER';

  const tierLimits = {
    STARTER: { manpower: 30, machines: 5 },
    GROWTH: { manpower: 150, machines: 25 },
    ENTERPRISE: { manpower: Infinity, machines: Infinity },
  };

  const activeLimits = tierLimits[currentTier as keyof typeof tierLimits] || tierLimits.STARTER;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-card border border-border shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Billing & Subscription Settings
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Manage your company's subscription plan, view limits, and process payments securely via Razorpay.
          </p>
        </div>
        <div className={clsx(
          "px-3 py-1.5 rounded-lg border text-sm font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
          currentTier === 'ENTERPRISE' && "bg-purple-50 text-purple-700 border-purple-200",
          currentTier === 'GROWTH' && "bg-emerald-50 text-emerald-700 border-emerald-200",
          currentTier === 'STARTER' && "bg-sky-50 text-sky-700 border-sky-200"
        )}>
          <Sparkles className="h-4 w-4" />
          {currentTier} PLAN
        </div>
      </div>

      {/* Usage Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manpower Usage */}
        <div className="bg-white p-6 rounded-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-text-secondary" />
              <span className="font-bold text-text-primary text-sm">Manpower Resource Limits</span>
            </div>
            <span className="text-xs font-semibold text-text-secondary">
              {manpowerCount} / {activeLimits.manpower === Infinity ? 'Unlimited' : activeLimits.manpower} Workers
            </span>
          </div>
          {activeLimits.manpower !== Infinity && (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    (manpowerCount / activeLimits.manpower) > 0.9 ? "bg-danger" : (manpowerCount / activeLimits.manpower) > 0.7 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((manpowerCount / activeLimits.manpower) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-text-secondary text-right">
                {Math.round((manpowerCount / activeLimits.manpower) * 100)}% Capacity Utilized
              </p>
            </div>
          )}
        </div>

        {/* Machine Usage */}
        <div className="bg-white p-6 rounded-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-text-secondary" />
              <span className="font-bold text-text-primary text-sm">Machine Resource Limits</span>
            </div>
            <span className="text-xs font-semibold text-text-secondary">
              {machinesCount} / {activeLimits.machines === Infinity ? 'Unlimited' : activeLimits.machines} Machines
            </span>
          </div>
          {activeLimits.machines !== Infinity && (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    (machinesCount / activeLimits.machines) > 0.9 ? "bg-danger" : (machinesCount / activeLimits.machines) > 0.7 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((machinesCount / activeLimits.machines) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-text-secondary text-right">
                {Math.round((machinesCount / activeLimits.machines) * 100)}% Capacity Utilized
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plan Upgrade Selector Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-base font-bold text-text-primary">Available Subscription Plans</h3>
          
          {/* Billing Cycle Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg border border-border/60 w-fit">
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={clsx(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer text-center",
                billingCycle === 'yearly' ? "bg-white text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
              )}
            >
              Yearly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={clsx(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer text-center",
                billingCycle === 'monthly' ? "bg-white text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
              )}
            >
              Monthly Billing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter Plan Card */}
          <div className={clsx(
            "bg-white rounded-card border overflow-hidden flex flex-col justify-between shadow-xs transition-all relative",
            currentTier === 'STARTER' ? "border-sky-300 ring-1 ring-sky-300/40" : "border-border"
          )}>
            {currentTier === 'STARTER' && (
              <div className="bg-sky-500 text-white text-[9px] font-bold tracking-wider uppercase py-1 text-center absolute top-0 inset-x-0">
                Current Active Plan
              </div>
            )}
            <div className="p-6 pt-8 space-y-4">
              <div className="text-sky-700 bg-sky-50 border border-sky-100 rounded-lg p-2.5 w-fit">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-text-primary text-base">Starter Tier</h4>
                <p className="text-[11px] text-text-secondary mt-1">Perfect for small operations starting their digital reporting journey.</p>
              </div>
              <div className="text-2xl font-extrabold text-text-primary">
                {billingCycle === 'yearly' ? 'Rs. 14,999' : 'Rs. 1,499'}
                <span className="text-xs font-normal text-text-secondary"> / {billingCycle === 'yearly' ? 'year' : 'month'}</span>
                <span className="text-xs font-normal text-text-secondary block mt-0.5">Entry-level paid capabilities</span>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary border-t border-border pt-4">
                <li className="flex items-center gap-2 font-semibold text-sky-700">✓ Max 30 workers</li>
                <li className="flex items-center gap-2 font-semibold text-sky-700">✓ Max 5 machines</li>
                <li className="flex items-center gap-2">✓ Custom dynamic columns</li>
                <li className="flex items-center gap-2">✓ Excel, PDF, CSV, TXT Exports</li>
              </ul>
            </div>
            <div className="p-6 bg-gray-50 border-t border-border">
              {currentTier === 'STARTER' ? (
                <button 
                  onClick={() => {
                    setSelectedUpgradeTier('STARTER');
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Renew / Pay Starter Plan
                </button>
              ) : (
                <button disabled className="w-full bg-gray-200 text-gray-500 py-2 rounded-lg text-xs font-semibold cursor-not-allowed">
                  Downgrade Blocked
                </button>
              )}
            </div>
          </div>

          {/* Growth Plan Card */}
          <div className={clsx(
            "bg-white rounded-card border overflow-hidden flex flex-col justify-between shadow-xs transition-all relative",
            currentTier === 'GROWTH' ? "border-emerald-300 ring-1 ring-emerald-300/40" : "border-border"
          )}>
            {currentTier === 'GROWTH' && (
              <div className="bg-emerald-500 text-white text-[9px] font-bold tracking-wider uppercase py-1 text-center absolute top-0 inset-x-0">
                Current Active Plan
              </div>
            )}
            <div className="p-6 pt-8 space-y-4">
              <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 w-fit">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-text-primary text-base">Growth Tier</h4>
                <p className="text-[11px] text-text-secondary mt-1">Optimized for growing manufacturing setups and medium factories.</p>
              </div>
              <div className="text-2xl font-extrabold text-text-primary">
                {billingCycle === 'yearly' ? 'Rs. 49,999' : 'Rs. 4,999'}
                <span className="text-xs font-normal text-text-secondary"> / {billingCycle === 'yearly' ? 'year' : 'month'}</span>
                <span className="text-xs font-normal text-text-secondary block mt-0.5">Flexible resource parameters</span>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary border-t border-border pt-4">
                <li className="flex items-center gap-2 font-semibold text-emerald-700">✓ Max 150 workers</li>
                <li className="flex items-center gap-2 font-semibold text-emerald-700">✓ Max 25 machines</li>
                <li className="flex items-center gap-2">✓ Custom dynamic columns</li>
                <li className="flex items-center gap-2">✓ Excel, PDF, CSV, TXT Exports</li>
              </ul>
            </div>
            <div className="p-6 bg-gray-50 border-t border-border">
              {currentTier === 'GROWTH' ? (
                <button 
                  onClick={() => {
                    setSelectedUpgradeTier('GROWTH');
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Renew / Pay Growth Plan
                </button>
              ) : currentTier === 'ENTERPRISE' ? (
                <button disabled className="w-full bg-gray-200 text-gray-500 py-2 rounded-lg text-xs font-semibold cursor-not-allowed">
                  Downgrade Blocked
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setSelectedUpgradeTier('GROWTH');
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Upgrade to Growth Plan
                </button>
              )}
            </div>
          </div>

          {/* Enterprise Plan Card */}
          <div className={clsx(
            "bg-white rounded-card border overflow-hidden flex flex-col justify-between shadow-xs transition-all relative",
            currentTier === 'ENTERPRISE' ? "border-purple-300 ring-1 ring-purple-300/40" : "border-border"
          )}>
            {currentTier === 'ENTERPRISE' && (
              <div className="bg-purple-500 text-white text-[9px] font-bold tracking-wider uppercase py-1 text-center absolute top-0 inset-x-0">
                Current Active Plan
              </div>
            )}
            <div className="p-6 pt-8 space-y-4">
              <div className="text-purple-700 bg-purple-50 border border-purple-100 rounded-lg p-2.5 w-fit">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-text-primary text-base">Enterprise Tier</h4>
                <p className="text-[11px] text-text-secondary mt-1">For large factories requiring scale, unrestricted users and logs.</p>
              </div>
              <div className="text-2xl font-extrabold text-text-primary">
                {billingCycle === 'yearly' ? 'Rs. 1,49,999' : 'Rs. 14,999'}
                <span className="text-xs font-normal text-text-secondary"> / {billingCycle === 'yearly' ? 'year' : 'month'}</span>
                <span className="text-xs font-normal text-text-secondary block mt-0.5">Unrestricted capacity limits</span>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary border-t border-border pt-4">
                <li className="flex items-center gap-2 font-semibold text-purple-700">✓ Unlimited workers</li>
                <li className="flex items-center gap-2 font-semibold text-purple-700">✓ Unlimited machines</li>
                <li className="flex items-center gap-2">✓ Custom dynamic columns</li>
                <li className="flex items-center gap-2">✓ Excel, PDF, CSV, TXT Exports</li>
                <li className="flex items-center gap-2 font-semibold text-purple-700">✓ Indefinite data log archiving</li>
                <li className="flex items-center gap-2 font-semibold text-purple-700">✓ Priority phone & email support</li>
                <li className="flex items-center gap-2 font-semibold text-purple-700 font-bold">✓ AI Integration</li>
              </ul>
            </div>
            <div className="p-6 bg-gray-50 border-t border-border">
              {currentTier === 'ENTERPRISE' ? (
                <button 
                  onClick={() => {
                    setSelectedUpgradeTier('ENTERPRISE');
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Renew / Pay Enterprise Plan
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setSelectedUpgradeTier('ENTERPRISE');
                    setGeneratedLink(null);
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Upgrade to Enterprise Plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Checkout Dialog Modal */}
      {selectedUpgradeTier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-md w-full border border-border shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Upgrade Plan Subscription</h3>
                <p className="text-xs text-text-secondary font-bold uppercase text-primary">To {selectedUpgradeTier} Tier</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-semibold border-b border-border/50 pb-2">
                <span className="text-text-secondary">Billing Cycle:</span>
                <span className="text-text-primary font-bold capitalize">
                  {billingCycle}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold border-b border-border/50 pb-2">
                <span className="text-text-secondary">Upgrade Amount:</span>
                <span className="text-text-primary text-base font-bold">
                  {selectedUpgradeTier === 'STARTER'
                    ? (billingCycle === 'yearly' ? 'Rs. 14,999' : 'Rs. 1,499')
                    : selectedUpgradeTier === 'GROWTH'
                    ? (billingCycle === 'yearly' ? 'Rs. 49,999' : 'Rs. 4,999')
                    : (billingCycle === 'yearly' ? 'Rs. 1,49,999' : 'Rs. 14,999')
                  }
                </span>
              </div>

              {!generatedLink ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('checkout')}
                        className={clsx(
                          "p-3 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer",
                          paymentMethod === 'checkout' ? "border-primary text-primary bg-primary/5" : "border-border text-text-secondary bg-white hover:bg-gray-50"
                        )}
                      >
                        Pay Online (Razorpay SDK)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('link')}
                        className={clsx(
                          "p-3 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer",
                          paymentMethod === 'link' ? "border-primary text-primary bg-primary/5" : "border-border text-text-secondary bg-white hover:bg-gray-50"
                        )}
                      >
                        Generate Payment Link
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed">
                    {paymentMethod === 'checkout' 
                      ? 'Securely pay using cards, UPI, net banking, or wallets. The transaction will load the official Razorpay Checkout interface overlay.'
                      : 'Create a static payment link that you can share with your accountant or pay at your convenience. The system will email reminders if enabled.'}
                  </p>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUpgradeTier(null)}
                      className="border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurchase(selectedUpgradeTier, paymentMethod)}
                      disabled={processing}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-light transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {processing ? 'Processing...' : paymentMethod === 'checkout' ? 'Launch Checkout' : 'Create Link'}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-text-secondary">
                    Your subscription payment link has been generated. Share this URL to complete the checkout:
                  </p>
                  <div className="bg-surface border border-border p-3 rounded-lg flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      className="w-full bg-transparent text-xs font-mono text-text-primary focus:outline-none"
                      value={generatedLink}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-xs font-bold text-primary hover:text-primary-light whitespace-nowrap flex items-center gap-1"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={generatedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary text-white hover:bg-primary-light py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1 shadow-sm"
                    >
                      Open Link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedUpgradeTier(null)}
                      className="border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment & Billing History Table */}
      <div className="bg-white rounded-card border border-border shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border bg-gray-50 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-text-primary text-sm">Billing & Payment History</h3>
        </div>
        
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs text-left">
              <thead className="bg-surface text-text-secondary uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Order/Link ID</th>
                  <th className="px-6 py-3">Tier</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Payment ID</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-primary">
                {history.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                      {item.razorpay_order_id || item.payment_link_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold uppercase tracking-wider">{item.tier}</span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold whitespace-nowrap">
                      Rs. {item.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                      {item.razorpay_payment_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        item.status === 'SUCCESS' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        item.status === 'PENDING' && "bg-amber-50 text-amber-700 border-amber-200",
                        item.status === 'FAILED' && "bg-red-50 text-red-700 border-red-200"
                      )}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-text-secondary italic text-xs">
            No payment transactions logged for this company.
          </div>
        )}
      </div>
    </div>
  );
}
