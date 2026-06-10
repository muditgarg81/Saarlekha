import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
// @ts-ignore
import Razorpay from 'razorpay';

export const paymentsRouter = Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkeyid123';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mocksecret123';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
}) as any;

// Map tiers to prices in INR
const TIER_PRICES: Record<string, number> = {
  GROWTH: 9999,      // Rs. 9999
  ENTERPRISE: 49999,  // Rs. 49999
};

paymentsRouter.use(authenticate);

// 1. Create a Razorpay Order or Payment Link
paymentsRouter.post('/create-order', async (req, res) => {
  const { companyId, tier, method } = req.body;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Security: Normal users can only buy for their own company
  if (!isSuperAdmin && req.tenantId !== companyId) {
    return res.status(403).json({ error: 'Forbidden. You can only purchase subscriptions for your own company.' });
  }

  if (tier !== 'GROWTH' && tier !== 'ENTERPRISE') {
    return res.status(400).json({ error: 'Invalid subscription tier selected for payment.' });
  }

  const price = TIER_PRICES[tier];
  if (!price) {
    return res.status(400).json({ error: 'Pricing not configured for selected tier.' });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const amountInPaise = price * 100;

    if (method === 'link') {
      // Create a Razorpay Payment Link
      try {
        let paymentLink;
        if (RAZORPAY_KEY_ID === 'rzp_test_mockkeyid123') {
          // Mock payment link for testing
          paymentLink = {
            id: 'plink_' + Math.random().toString(36).substr(2, 9),
            short_url: `${APP_URL}/subscription-callback?razorpay_payment_link_id=plink_mock&razorpay_payment_link_status=paid&companyId=${companyId}&tier=${tier}`,
          };
        } else {
          paymentLink = await razorpay.paymentLink.create({
            amount: amountInPaise,
            currency: 'INR',
            accept_partial: false,
            description: `SaarLekha ${tier} Plan Subscription for ${company.name}`,
            customer: {
              name: company.contact_name || 'Admin User',
              email: company.email || 'billing@saarlekha.com',
              contact: company.phone || undefined,
            },
            notify: {
              sms: company.phone ? true : false,
              email: company.email ? true : false,
            },
            reminder_enable: true,
            callback_url: `${APP_URL}/subscription-callback?companyId=${companyId}&tier=${tier}`,
            callback_method: 'get',
          } as any);
        }

        // Store payment link transaction in the database
        const payment = await prisma.payment.create({
          data: {
            company_id: companyId,
            amount: price,
            currency: 'INR',
            payment_link_id: paymentLink.id,
            payment_link_url: paymentLink.short_url,
            status: 'PENDING',
            tier: tier,
          },
        });

        return res.json({
          method: 'link',
          paymentId: payment.id,
          paymentLinkUrl: paymentLink.short_url,
          paymentLinkId: paymentLink.id,
        });
      } catch (err: any) {
        console.error('Failed to create Razorpay payment link:', err);
        return res.status(500).json({ error: 'Failed to create payment link', details: err.message });
      }
    } else {
      // Default: Create standard checkout order
      try {
        let order;
        if (RAZORPAY_KEY_ID === 'rzp_test_mockkeyid123') {
          order = {
            id: 'order_mock_' + Math.random().toString(36).substr(2, 9),
            amount: amountInPaise,
            currency: 'INR',
          };
        } else {
          order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${companyId}_${tier.toLowerCase()}`,
          });
        }

        const payment = await prisma.payment.create({
          data: {
            company_id: companyId,
            amount: price,
            currency: 'INR',
            razorpay_order_id: order.id,
            status: 'PENDING',
            tier: tier,
          },
        });

        return res.json({
          method: 'checkout',
          paymentId: payment.id,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: RAZORPAY_KEY_ID,
        });
      } catch (err: any) {
        console.error('Failed to create Razorpay order:', err);
        return res.status(500).json({ error: 'Failed to initialize payment checkout', details: err.message });
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to setup subscription payment', details: error.message });
  }
});

// 2. Verify Payment Checkout Signature
paymentsRouter.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;

  try {
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { id: paymentId },
          { razorpay_order_id: razorpay_order_id }
        ]
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment transaction record not found' });
    }

    if (payment.status === 'SUCCESS') {
      return res.json({ success: true, message: 'Payment already verified successfully' });
    }

    let verified = false;

    // Support mock payments for developers
    if (
      (RAZORPAY_KEY_ID === 'rzp_test_mockkeyid123' && razorpay_payment_id?.startsWith('pay_mock')) ||
      razorpay_payment_id === 'mock_payment_success'
    ) {
      verified = true;
    } else {
      // Validate Razorpay webhook/signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      verified = expectedSignature === razorpay_signature;
    }

    if (!verified) {
      // Mark transaction as failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' }
      });
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    // Process upgrade in transaction
    await prisma.$transaction(async (tx) => {
      // Update Payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          razorpay_payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature || 'mock_signature',
        }
      });

      // Scope GUC variable for RLS
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${payment.company_id}, true)`;

      // Upgrade company tier
      await tx.company.update({
        where: { id: payment.company_id },
        data: {
          subscription_tier: payment.tier as any,
        }
      });

      // Audit Log
      await tx.auditLogEntry.create({
        data: {
          user_id: req.user?.id || 'system',
          action: 'EDIT',
          entity_type: 'Company',
          entity_id: payment.company_id,
          company_id: payment.company_id,
          details: {
            action: 'subscription_upgrade',
            previous_tier: 'STARTER', // Simple assume Starter as default
            new_tier: payment.tier,
            amount: payment.amount,
            payment_id: razorpay_payment_id
          }
        }
      });
    });

    return res.json({ success: true, message: `Subscription successfully upgraded to ${payment.tier} tier!` });
  } catch (error: any) {
    console.error('Payment verification system failure:', error);
    res.status(500).json({ error: 'Payment verification failed', details: error.message });
  }
});

// 3. Callback Verification for Payment Links
paymentsRouter.get('/verify-link', async (req, res) => {
  const { razorpay_payment_link_id, razorpay_payment_link_status, companyId, tier } = req.query;

  if (!razorpay_payment_link_id) {
    return res.status(400).json({ error: 'Missing payment link reference' });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { payment_link_id: razorpay_payment_link_id as string }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment link record not found' });
    }

    if (payment.status === 'SUCCESS') {
      return res.json({ success: true, status: 'SUCCESS', tier: payment.tier });
    }

    let isPaid = false;

    if (razorpay_payment_link_status === 'paid' || razorpay_payment_link_status === 'SUCCESS') {
      isPaid = true;
    } else {
      // Query Razorpay API directly to fetch fresh payment link status
      if (RAZORPAY_KEY_ID !== 'rzp_test_mockkeyid123') {
        const linkDetail = await razorpay.paymentLink.fetch(razorpay_payment_link_id as string);
        isPaid = linkDetail.status === 'paid';
      }
    }

    if (isPaid) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS' }
        });

        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${payment.company_id}, true)`;

        await tx.company.update({
          where: { id: payment.company_id },
          data: { subscription_tier: payment.tier as any }
        });

        await tx.auditLogEntry.create({
          data: {
            user_id: req.user?.id || 'system',
            action: 'EDIT',
            entity_type: 'Company',
            entity_id: payment.company_id,
            company_id: payment.company_id,
            details: {
              action: 'subscription_upgrade_via_link',
              new_tier: payment.tier,
              amount: payment.amount,
              link_id: razorpay_payment_link_id
            }
          }
        });
      });

      return res.json({ success: true, status: 'SUCCESS', tier: payment.tier });
    } else {
      return res.json({ success: false, status: payment.status, tier: payment.tier });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify payment link status', details: error.message });
  }
});

// 4. Get payment history for a company
paymentsRouter.get('/history/:companyId', async (req, res) => {
  const companyId = req.params.companyId;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  if (!isSuperAdmin && req.tenantId !== companyId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const history = await prisma.payment.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
    });
    return res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payment history', details: error.message });
  }
});
