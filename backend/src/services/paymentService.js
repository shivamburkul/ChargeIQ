
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// ChargeIQ DemoPay - a self-contained, fully fake payment gateway.
//
// This project is a college project and must never move real money, so
// there is deliberately no Stripe/Razorpay/PayPal integration and no
// outbound network call of any kind. Instead this module reproduces the
// *shape* of a real gateway (card validation, a processing delay, a
// deterministic "decline" test card, a transaction id) purely in server
// memory, so the rest of the app (invoices, blockchain ledger, receipts)
// can be built exactly as if a real gateway were behind it.
// ---------------------------------------------------------------------------

// Well-known "always declines" test card number, mirroring the test cards
// real gateways (Stripe, Razorpay) publish - makes the demo feel authentic
// and gives a way to show the decline/retry path in a viva/demo.
const TEST_DECLINE_CARD = '4000000000000002';

function luhnCheck(num) {
  const digits = num.split('').reverse().map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return sum % 10 === 0;
}

function detectCardNetwork(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^6(?:011|5)/.test(number)) return 'RuPay';
  if (/^3[47]/.test(number)) return 'Amex';
  return 'Card';
}

/**
 * Validates demo card details the same way a real checkout form would
 * (format + Luhn + expiry in the future), without ever storing or
 * transmitting the raw card number anywhere.
 */
function validateCard({ cardNumber, cardName, expiry, cvv }) {
  const cleanNumber = String(cardNumber || '').replace(/\s+/g, '');

  if (!cardName || !cardName.trim()) {
    return { ok: false, message: 'Enter the name on the card.' };
  }
  if (!/^\d{13,19}$/.test(cleanNumber)) {
    return { ok: false, message: 'Enter a valid card number.' };
  }
  if (!luhnCheck(cleanNumber)) {
    return { ok: false, message: 'That card number looks invalid. Please double-check it.' };
  }
  if (!/^\d{2}\/\d{2}$/.test(String(expiry || ''))) {
    return { ok: false, message: 'Enter expiry as MM/YY.' };
  }
  const [mm, yy] = expiry.split('/').map(Number);
  if (mm < 1 || mm > 12) {
    return { ok: false, message: 'Enter a valid expiry month.' };
  }
  const expiryDate = new Date(2000 + yy, mm, 1);
  if (expiryDate < new Date()) {
    return { ok: false, message: 'This card has expired.' };
  }
  if (!/^\d{3,4}$/.test(String(cvv || ''))) {
    return { ok: false, message: 'Enter a valid CVV.' };
  }

  return { ok: true, cleanNumber, network: detectCardNetwork(cleanNumber) };
}

function maskCard(cleanNumber) {
  return `•••• •••• •••• ${cleanNumber.slice(-4)}`;
}

function generateTransactionId() {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * "Charges" a demo card. Always resolves (never throws) with either a
 * success or decline outcome, exactly like a real gateway's response body -
 * callers should read `.success` rather than relying on try/catch.
 */
function chargeCard({ cardNumber, cardName, expiry, cvv }, amount) {
  const validation = validateCard({ cardNumber, cardName, expiry, cvv });
  if (!validation.ok) {
    return { success: false, declineReason: validation.message };
  }

  if (validation.cleanNumber === TEST_DECLINE_CARD) {
    return {
      success: false,
      declineReason: 'Your card was declined by the issuing bank (demo test card).',
      cardBrand: validation.network,
      maskedCard: maskCard(validation.cleanNumber),
    };
  }

  return {
    success: true,
    transactionId: generateTransactionId(),
    cardBrand: validation.network,
    maskedCard: maskCard(validation.cleanNumber),
    amount,
    gateway: 'ChargeIQ DemoPay',
    processedAt: new Date().toISOString(),
  };
}

module.exports = { chargeCard, validateCard, TEST_DECLINE_CARD, maskCard };
