import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Lock,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { taka } from '../lib/format';
import { ErrorBox, PageLoader, Spinner } from '../components/ui';
import { Logo } from '../components/Layout';

const METHODS = [
  { id: 'bkash', name: 'bKash', icon: Smartphone, tint: 'bg-pink-600', note: 'Mobile wallet' },
  { id: 'nagad', name: 'Nagad', icon: Wallet, tint: 'bg-orange-500', note: 'Mobile wallet' },
  {
    id: 'card',
    name: 'Card',
    icon: CreditCard,
    tint: 'bg-indigo-600',
    note: 'Visa · Mastercard · Amex',
  },
] as const;

/**
 * Stand-in for a payment gateway's hosted checkout page (SSLCommerz, bKash).
 * The real gateway would call our webhook; here the Pay button asks the API to
 * sign and deliver that same webhook, so the full server path is exercised.
 * It never asks for card or wallet details.
 */
export default function MockPay() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('bkash');
  const payment = useQuery({
    queryKey: ['mockpay', ref],
    queryFn: () =>
      api<{ ref: string; amountBdt: number; status: string; bookingId: string }>(
        `/payments/mockpay/${ref}`,
      ),
  });
  const simulate = useMutation({
    mutationFn: (outcome: 'succeeded' | 'failed') =>
      api(`/payments/mockpay/${ref}/simulate`, { method: 'POST', body: { outcome } }),
    onSuccess: () => setTimeout(() => navigate(`/bookings/${payment.data!.bookingId}`), 900),
  });

  if (payment.isLoading) return <PageLoader />;
  if (payment.error)
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBox error={payment.error} />
      </div>
    );
  const p = payment.data!;
  const chosen = METHODS.find((m) => m.id === method)!;
  const done = simulate.isSuccess && simulate.variables === 'succeeded';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-amber-400 px-4 py-2 text-center text-xs font-bold text-ink-900">
        <FlaskConical className="mr-1 inline h-3.5 w-3.5" /> Sandbox gateway: no real money moves
        and no payment details are collected.
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-amber-400">
              <Lock className="h-4 w-4" />
            </span>
            MockPay <span className="font-medium text-slate-400">Secure Checkout</span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            <ShieldCheck className="h-3.5 w-3.5" /> Test mode
          </span>
        </div>
      </header>

      <div className="mx-auto grid grid-cols-1 max-w-4xl gap-6 px-4 py-10 md:grid-cols-[1fr_1.2fr]">
        <div className="card self-start p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Paying</div>
          <div className="mt-3">
            <Logo />
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Order</dt>
              <dd className="font-mono font-semibold">
                TF-{p.bookingId.slice(0, 8).toUpperCase()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Reference</dt>
              <dd className="max-w-40 truncate font-mono text-xs font-semibold">{p.ref}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Service fee</dt>
              <dd className="font-semibold">{taka(0)}</dd>
            </div>
          </dl>
          <div className="mt-6 flex items-end justify-between border-t border-dashed border-slate-200 pt-5">
            <span className="font-semibold text-slate-500">Total</span>
            <span className="text-3xl font-extrabold">{taka(p.amountBdt)}</span>
          </div>
          <Link
            to={`/bookings/${p.bookingId}`}
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Cancel and return
          </Link>
        </div>

        <div className="card p-6">
          {p.status !== 'initiated' || done ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </span>
              <h2 className="mt-4 text-2xl font-extrabold">
                {done ? 'Payment successful' : `Payment ${p.status}`}
              </h2>
              <p className="mt-1 text-slate-500">
                {done ? 'Taking you back to your booking…' : 'This checkout is no longer open.'}
              </p>
              {!done && (
                <Link to={`/bookings/${p.bookingId}`} className="btn-primary mt-6">
                  Back to booking
                </Link>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-lg font-extrabold">Choose a payment method</h2>
              <div className="mt-4 space-y-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition',
                      method === m.id
                        ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-xl text-white',
                        m.tint,
                      )}
                    >
                      <m.icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold">{m.name}</span>
                      <span className="block text-xs text-slate-500">{m.note}</span>
                    </span>
                    <span
                      className={clsx(
                        'flex h-5 w-5 items-center justify-center rounded-full border-2',
                        method === m.id ? 'border-brand-600' : 'border-slate-300',
                      )}
                    >
                      {method === m.id && (
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                In production you would be sent to {chosen.name} to approve the payment. This
                sandbox simulates the result instead and notifies TechFinder with a signed webhook.
              </p>
              <button
                className="btn-primary mt-5 w-full py-3.5 text-base"
                disabled={simulate.isPending}
                onClick={() => simulate.mutate('succeeded')}
              >
                {simulate.isPending ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}{' '}
                Pay {taka(p.amountBdt)} with {chosen.name}
              </button>
              <button
                className="btn-ghost mt-2 w-full text-slate-500"
                disabled={simulate.isPending}
                onClick={() => simulate.mutate('failed')}
              >
                Simulate a failed payment
              </button>
              <div className="mt-3">
                <ErrorBox error={simulate.error} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
