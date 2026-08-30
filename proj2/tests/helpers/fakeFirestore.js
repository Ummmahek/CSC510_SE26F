// Minimal in-memory stand-in for the `db` object exported by server/config/firebase.js.
//
// Why this exists: the real app talks to Google Cloud Firestore (or its local emulator,
// server/docker-compose.yml). Neither Docker nor the emulator toolchain (gcloud/firebase-cli/java)
// is available in this test environment, so tests jest.mock('../server/config/firebase', ...) with
// this fake instead of hitting real/emulated Firestore. This is an explicit environment assumption
// -- see the "assumptions" note in the test report.
//
// The fake intentionally mirrors two real-Firestore behaviors that the routes under test rely on
// (implicitly or explicitly):
//   1. DocumentReference.update() on a document that does not exist rejects (NOT_FOUND), it does
//      not silently no-op or create the doc.
//   2. get()/set()/update() are asynchronous and resolve on a later tick (via a real setTimeout,
//      not an immediate microtask), so that two concurrent requests hitting the same document can
//      genuinely interleave -- this is what makes the race-condition tests (UC10, UC15) meaningful
//      rather than an artifact of synchronous mocking.

function cloneData(data) {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

function applyDotPath(target, path, value) {
  const parts = path.split('.');
  let obj = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof obj[key] !== 'object' || obj[key] === null) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  obj[parts[parts.length - 1]] = value;
}

function matchesOp(fieldValue, op, value) {
  switch (op) {
    case '==':
      return fieldValue === value;
    case '!=':
      return fieldValue !== value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case '<':
      return fieldValue < value;
    case '<=':
      return fieldValue <= value;
    case '>':
      return fieldValue > value;
    case '>=':
      return fieldValue >= value;
    default:
      throw new Error(`fakeFirestore: unsupported operator "${op}"`);
  }
}

// Deliberately non-zero: gives concurrent requests a real window in which both can read
// before either has written, matching the check-then-act race the source code has.
const OP_DELAY_MS = 15;

function delay() {
  return new Promise((resolve) => setTimeout(resolve, OP_DELAY_MS));
}

let autoIdCounter = 0;
function generateId() {
  autoIdCounter += 1;
  return `auto-${autoIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

class FakeDocRef {
  constructor(store, collectionName, id) {
    this._store = store;
    this.collectionName = collectionName;
    this.id = id;
  }

  _collectionMap() {
    if (!this._store.has(this.collectionName)) {
      this._store.set(this.collectionName, new Map());
    }
    return this._store.get(this.collectionName);
  }

  async get() {
    await delay();
    const coll = this._collectionMap();
    const exists = coll.has(this.id);
    const data = exists ? cloneData(coll.get(this.id)) : undefined;
    return {
      exists,
      id: this.id,
      data: () => data,
      ref: this,
    };
  }

  async set(data, opts = {}) {
    await delay();
    const coll = this._collectionMap();
    if (opts.merge && coll.has(this.id)) {
      coll.set(this.id, { ...coll.get(this.id), ...cloneData(data) });
    } else {
      coll.set(this.id, cloneData(data));
    }
    return {};
  }

  async update(data) {
    await delay();
    const coll = this._collectionMap();
    if (!coll.has(this.id)) {
      const err = new Error(
        `fakeFirestore: No document to update: ${this.collectionName}/${this.id}`
      );
      err.code = 5; // mirrors the gRPC NOT_FOUND code real Firestore throws here
      throw err;
    }
    const updated = cloneData(coll.get(this.id));
    for (const [key, value] of Object.entries(data)) {
      applyDotPath(updated, key, cloneData(value));
    }
    coll.set(this.id, updated);
    return {};
  }
}

class FakeQuery {
  constructor(store, collectionName, predicates, orderBySpec) {
    this._store = store;
    this.collectionName = collectionName;
    this._predicates = predicates || [];
    this._orderBySpec = orderBySpec || null;
  }

  where(field, op, value) {
    return new FakeQuery(
      this._store,
      this.collectionName,
      [...this._predicates, (data) => matchesOp(data[field], op, value)],
      this._orderBySpec
    );
  }

  orderBy(field, direction = 'asc') {
    return new FakeQuery(this._store, this.collectionName, this._predicates, { field, direction });
  }

  limit(n) {
    return new FakeLimitedQuery(this, n);
  }

  async get() {
    await delay();
    const coll = this._store.has(this.collectionName)
      ? this._store.get(this.collectionName)
      : new Map();
    const matchingIds = [];
    for (const [id, data] of coll.entries()) {
      if (this._predicates.every((pred) => pred(data))) {
        matchingIds.push(id);
      }
    }
    if (this._orderBySpec) {
      const { field, direction } = this._orderBySpec;
      const sign = direction === 'desc' ? -1 : 1;
      matchingIds.sort((a, b) => {
        const va = coll.get(a)[field];
        const vb = coll.get(b)[field];
        if (va < vb) return -1 * sign;
        if (va > vb) return 1 * sign;
        return 0;
      });
    }
    return this._buildSnapshot(matchingIds);
  }

  _buildSnapshot(ids) {
    const store = this._store;
    const collectionName = this.collectionName;
    const coll = store.get(collectionName) || new Map();
    const docs = ids.map((id) => {
      const data = cloneData(coll.get(id));
      return {
        id,
        exists: true,
        data: () => data,
        ref: new FakeDocRef(store, collectionName, id),
      };
    });
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

class FakeLimitedQuery {
  constructor(query, n) {
    this._query = query;
    this._n = n;
  }

  async get() {
    const snap = await this._query.get();
    const docs = snap.docs.slice(0, this._n);
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

class FakeCollectionRef extends FakeQuery {
  constructor(store, collectionName) {
    super(store, collectionName, []);
  }

  doc(id) {
    return new FakeDocRef(this._store, this.collectionName, id || generateId());
  }
}

function createFirestoreMock() {
  const store = new Map();

  const db = {
    collection(name) {
      return new FakeCollectionRef(store, name);
    },
    // Test-only helpers (not part of the real Firestore API surface):
    __reset() {
      store.clear();
    },
    __seed(collectionName, id, data) {
      if (!store.has(collectionName)) store.set(collectionName, new Map());
      store.get(collectionName).set(id, cloneData(data));
    },
  };

  const admin = {
    firestore: {
      GeoPoint: function GeoPoint(lat, lng) {
        this.latitude = lat;
        this.longitude = lng;
      },
    },
  };

  return { db, admin, auth: {} };
}

module.exports = { createFirestoreMock };
