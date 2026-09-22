
const { getDb } = require('../config/firebase');
const { getNextId } = require('../utils/idCounter');
const Op = require('../utils/op');

const IN_QUERY_CHUNK = 30; // Firestore's max size for an "in" filter

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Wraps a plain data object with Sequelize-instance-style helpers
// (.save(), .destroy(), .toJSON()) without polluting the enumerable/
// serialized fields, so `res.json({ booking })` keeps working exactly like
// it did with Sequelize.
function attachInstanceMethods(model, data) {
  Object.defineProperty(data, 'save', {
    enumerable: false,
    value: async function save() {
      const { id, ...rest } = data;
      await getDb().collection(model.collectionName).doc(String(id)).set(rest, { merge: true });
      return data;
    },
  });
  Object.defineProperty(data, 'destroy', {
    enumerable: false,
    value: async function destroy() {
      await getDb().collection(model.collectionName).doc(String(data.id)).delete();
      return true;
    },
  });
  Object.defineProperty(data, 'toJSON', {
    enumerable: false,
    value: function toJSON() {
      return { ...data };
    },
  });
  return data;
}

function docToInstance(model, doc) {
  const data = { id: Number(doc.id), ...doc.data() };
  return attachInstanceMethods(model, data);
}

class FirestoreModel {
  constructor(collectionName, defaults = {}) {
    this.collectionName = collectionName;
    this.defaults = defaults;
  }

  // Applies simple equality / `in` (array) / range ({[Op.gte]: x}) filters.
  // Deliberately does NOT combine `where` with Firestore `orderBy` - mixing
  // the two usually requires manually creating a composite index in the
  // Firebase console, which isn't realistic to ask of someone who has never
  // used Firebase before. Instead we filter in Firestore and sort/paginate
  // the (small, per-user) result set in JS, which needs no index setup at
  // all and is plenty fast for a project of this size.
  async _query(where = {}) {
    const db = getDb();
    let ref = db.collection(this.collectionName);
    let inField = null;
    let inValues = null;

    Object.entries(where).forEach(([field, condition]) => {
      if (Array.isArray(condition)) {
        inField = field;
        inValues = condition;
        return;
      }
      if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        Object.entries(condition).forEach(([opKey, opVal]) => {
          if (opKey === Op.gte) ref = ref.where(field, '>=', opVal instanceof Date ? opVal.toISOString() : opVal);
          if (opKey === Op.lte) ref = ref.where(field, '<=', opVal instanceof Date ? opVal.toISOString() : opVal);
        });
        return;
      }
      ref = ref.where(field, '==', condition);
    });

    if (!inField) {
      const snap = await ref.get();
      return snap.docs.map((d) => docToInstance(this, d));
    }

    // Firestore "in" filters are capped at 30 values - chunk and merge.
    const chunks = chunk(inValues, IN_QUERY_CHUNK);
    const results = await Promise.all(
      chunks.map((vals) => ref.where(inField, 'in', vals).get())
    );
    const seen = new Set();
    const out = [];
    results.forEach((snap) => {
      snap.docs.forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          out.push(docToInstance(this, d));
        }
      });
    });
    return out;
  }

  async findAll({ where = {}, order, limit } = {}) {
    let rows = await this._query(where);

    if (order && order.length) {
      const [field, dir] = order[0];
      rows.sort((a, b) => {
        const av = a[field], bv = b[field];
        const aTime = av instanceof Date ? av.getTime() : new Date(av).getTime();
        const bTime = bv instanceof Date ? bv.getTime() : new Date(bv).getTime();
        const cmp = (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
        return dir && dir.toUpperCase() === 'DESC' ? -cmp : cmp;
      });
    } else {
      // Default to newest-first by createdAt when the model has it, so
      // list views feel sensible even without an explicit order.
      rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    if (limit) rows = rows.slice(0, limit);
    return rows;
  }

  async findOne({ where = {} } = {}) {
    if (where.id !== undefined) {
      const rest = { ...where };
      delete rest.id;
      const doc = await this.findByPk(where.id);
      if (!doc) return null;
      const matches = Object.entries(rest).every(([k, v]) => doc[k] === v);
      return matches ? doc : null;
    }
    const rows = await this._query(where);
    return rows[0] || null;
  }

  async findByPk(id) {
    if (id === undefined || id === null) return null;
    const doc = await getDb().collection(this.collectionName).doc(String(id)).get();
    if (!doc.exists) return null;
    return docToInstance(this, doc);
  }

  async count(where = {}) {
    const rows = await this._query(where);
    return rows.length;
  }

  async create(data) {
    const id = await getNextId(this.collectionName);
    const now = new Date().toISOString();
    const record = { ...this.defaults, ...data, id, createdAt: now, updatedAt: now };
    const { id: _id, ...rest } = record;
    await getDb().collection(this.collectionName).doc(String(id)).set(rest);
    return attachInstanceMethods(this, record);
  }

  // Bulk update matching `where` - used for small "mark all as read" /
  // "unset previous default" style operations. Kept simple (no index
  // requirements) since it's only ever used on small, per-user result sets.
  async update(patch, { where = {} } = {}) {
    const rows = await this._query(where);
    await Promise.all(rows.map((r) => {
      Object.assign(r, patch);
      return r.save();
    }));
    return rows.length;
  }
}

module.exports = FirestoreModel;


