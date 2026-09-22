
const crypto = require('crypto');
const { getDb } = require('../config/firebase');
const { getNextId } = require('../utils/idCounter');

// ---------------------------------------------------------------------------
// A minimal, from-scratch blockchain used to give every successful payment
// a tamper-evident, independently-verifiable record. This is built for a
// college project: it is a REAL hash chain with REAL proof-of-work mining
// (same core idea as Bitcoin's chain), but it deliberately does not touch
// any real cryptocurrency, wallet, or network - it is a private, append-only
// ledger scoped to this platform, which is exactly what the brief needs
// ("blockchain implemented, but not real money").
//
// Each block stores:
//   index         - position in the chain (0 = genesis)
//   timestamp     - ISO time the block was mined
//   data          - the transaction payload (payment/booking details)
//   previousHash  - the hash of the block before it (this is what makes the
//                   chain tamper-evident: changing any past block changes
//                   its hash, which breaks every link after it)
//   nonce         - the number that had to be found so the hash meets the
//                   difficulty target (the "proof of work")
//   hash          - sha256 of everything above
// ---------------------------------------------------------------------------

const COLLECTION = 'blockchain_blocks';
const GENESIS_HASH = '0'.repeat(64);
// Difficulty kept low (3 leading zeros) so mining stays instant server-side
// for a snappy demo, while still being a genuine, visible proof-of-work.
const DIFFICULTY = 3;

function computeHash({ index, timestamp, data, previousHash, nonce }) {
  const payload = `${index}|${timestamp}|${JSON.stringify(data)}|${previousHash}|${nonce}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function mine({ index, timestamp, data, previousHash }) {
  const target = '0'.repeat(DIFFICULTY);
  let nonce = 0;
  let hash = computeHash({ index, timestamp, data, previousHash, nonce });
  while (!hash.startsWith(target)) {
    nonce += 1;
    hash = computeHash({ index, timestamp, data, previousHash, nonce });
  }
  return { nonce, hash };
}

async function getChain() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  const blocks = snap.docs.map((d) => d.data());
  blocks.sort((a, b) => a.index - b.index);
  return blocks;
}

async function getLatestBlock() {
  const chain = await getChain();
  return chain.length ? chain[chain.length - 1] : null;
}

/**
 * Mines and appends a new block containing `data` to the chain.
 * Returns the full stored block.
 */
async function addBlock(data) {
  const db = getDb();
  const latest = await getLatestBlock();
  const index = await getNextId(COLLECTION); // sequential -> doubles as the chain index (genesis = 1)
  const timestamp = new Date().toISOString();
  const previousHash = latest ? latest.hash : GENESIS_HASH;

  const { nonce, hash } = mine({ index, timestamp, data, previousHash });
  const block = { index, timestamp, data, previousHash, nonce, hash };

  await db.collection(COLLECTION).doc(String(index)).set(block);
  return block;
}

/**
 * Re-derives every block's hash from its stored contents and checks the
 * previousHash links, exactly like a real blockchain client would when
 * validating a chain it received. Used by the "Verify ledger" action in the
 * admin panel so the integrity check is genuine, not decorative.
 */
async function verifyChain() {
  const chain = await getChain();
  for (let i = 0; i < chain.length; i += 1) {
    const block = chain[i];
    const recomputed = computeHash(block);
    if (recomputed !== block.hash) {
      return { valid: false, brokenAtIndex: block.index, reason: `Block #${block.index} hash does not match its contents - data may have been altered.` };
    }
    const expectedPrevHash = i === 0 ? GENESIS_HASH : chain[i - 1].hash;
    if (block.previousHash !== expectedPrevHash) {
      return { valid: false, brokenAtIndex: block.index, reason: `Block #${block.index} is not correctly linked to the previous block.` };
    }
  }
  return { valid: true, blockCount: chain.length };
}

async function findBlocksByBookingId(bookingId) {
  const chain = await getChain();
  return chain.filter((b) => b.data && Number(b.data.bookingId) === Number(bookingId));
}

async function findBlockByPaymentId(paymentId) {
  const chain = await getChain();
  return chain.find((b) => b.data && Number(b.data.paymentId) === Number(paymentId)) || null;
}

module.exports = {
  addBlock,
  getChain,
  verifyChain,
  findBlocksByBookingId,
  findBlockByPaymentId,
  GENESIS_HASH,
  DIFFICULTY,
};
