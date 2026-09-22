
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { paymentApi } from '../api/endpoints';
import Spinner from './Spinner';

const PROCESSING_STEPS = [
  'Contacting ChargeIQ DemoPay…',
  'Validating card details…',
  'Mining blockchain block…',
  'Finalizing transaction…',
];

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function PaymentModal({ payment, onClose, onSuccess }) {
  const [form, setForm] = useState({ cardNumber: '', cardName: '', expiry: '', cvv: '' });
  const [step, setStep] = useState('form'); // form | processing | success | declined
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [processingLabel, setProcessingLabel] = useState(PROCESSING_STEPS[0]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function fillTestCard(kind) {
    setForm({
      cardNumber: kind === 'decline' ? '4000 0000 0000 0002' : '4242 4242 4242 4242',
      cardName: 'Test Student',
      expiry: '12/29',
      cvv: '123',
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (form.cardNumber.replace(/\s/g, '').length < 13) return setError('Enter a valid card number.');
    if (!form.cardName.trim()) return setError('Enter the name on the card.');
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) return setError('Enter expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(form.cvv)) return setError('Enter a valid CVV.');

    setStep('processing');
    // Purely cosmetic staged messages so the "gateway → blockchain" flow is
    // visible to whoever's demoing the project, matching how real
    // checkout flows show a multi-step spinner.
    PROCESSING_STEPS.forEach((label, i) => {
      setTimeout(() => setProcessingLabel(label), i * 550);
    });

    try {
      const res = await paymentApi.confirm(payment.id, form);
      await new Promise((r) => setTimeout(r, PROCESSING_STEPS.length * 550 + 300));
      setResult(res.data);
      setStep('success');
      setTimeout(() => onSuccess(res.data), 1400);
    } catch (err) {
      await new Promise((r) => setTimeout(r, PROCESSING_STEPS.length * 550 + 300));
      setResult(err.response?.data || null);
      setError(err.response?.data?.message || 'Payment could not be processed.');
      setStep('declined');
    }
  }

  return createPortal(
    <div className="booking-modal fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="card w-full sm:max-w-md max-h-[90vh] sm:max-h-[78vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-6"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Complete payment</h2>
            <p className="text-xs text-slate-500">ChargeIQ DemoPay · no real money is ever charged</p>
          </div>
          {step === 'form' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          )}
        </div>

        <div className="rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 p-3 mb-4 flex justify-between items-center">
          <span className="text-sm text-slate-600 dark:text-slate-300">Amount due</span>
          <span className="font-display text-xl font-bold text-brand-600">₹{payment.amount}</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Card number</label>
                <input
                  className="input-field"
                  placeholder="4242 4242 4242 4242"
                  value={form.cardNumber}
                  onChange={(e) => update('cardNumber', formatCardNumber(e.target.value))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name on card</label>
                <input className="input-field" placeholder="Full name" value={form.cardName} onChange={(e) => update('cardName', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Expiry</label>
                  <input className="input-field" placeholder="MM/YY" value={form.expiry} onChange={(e) => update('expiry', formatExpiry(e.target.value))} inputMode="numeric" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">CVV</label>
                  <input className="input-field" placeholder="123" value={form.cvv} onChange={(e) => update('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button type="submit" className="btn-primary w-full mt-2">Pay ₹{payment.amount}</button>

              <div className="flex gap-2 justify-center pt-1">
                <button type="button" onClick={() => fillTestCard('success')} className="text-[11px] text-slate-400 hover:text-brand-600">Use test card (success)</button>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={() => fillTestCard('decline')} className="text-[11px] text-slate-400 hover:text-red-500">Use test card (declined)</button>
              </div>
              <p className="text-[11px] text-slate-400 text-center">This is a simulated gateway built for a college project. Card details are never stored or sent anywhere real.</p>
            </motion.form>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center text-center">
              <Spinner size={36} />
              <p className="text-sm font-medium mt-4">{processingLabel}</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center text-center">
              <div className="text-5xl mb-2">✅</div>
              <h3 className="font-display text-lg font-bold text-brand-600">Payment successful</h3>
              <p className="text-sm text-slate-500 mt-1">Transaction {result?.payment?.transactionId}</p>
              <p className="text-xs text-slate-400 mt-1">Recorded on blockchain · block #{result?.block?.index}</p>
            </motion.div>
          )}

          {step === 'declined' && (
            <motion.div key="declined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center text-center">
              <div className="text-5xl mb-2">❌</div>
              <h3 className="font-display text-lg font-bold text-red-500">Payment declined</h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">{error}</p>
              <button onClick={() => { setStep('form'); setError(''); }} className="btn-secondary">Try again</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}
