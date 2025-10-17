// api/index.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load seed JSON once at cold-start
const seedPath = path.join(__dirname, '..', 'seed.json');
let db = { companies: [], cities: [], tags: [], jobs: [], cvs: [] };

try {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  db.companies = Array.isArray(parsed.companies) ? parsed.companies.slice() : [];
  db.cities = Array.isArray(parsed.cities) ? parsed.cities.slice() : [];
  db.tags = Array.isArray(parsed.tags) ? parsed.tags.slice() : [];
  db.jobs = Array.isArray(parsed.jobs) ? parsed.jobs.slice() : [];
  db.cvs = Array.isArray(parsed.cvs) ? parsed.cvs.slice() : [];
} catch (err) {
  console.warn('Cannot load seed.json:', err.message);
}

// Utility helpers (use field 'id' if exists, otherwise create numeric id)
function getCollection(name) {
  return db[name];
}
function getNextId(arr) {
  // find numeric max id in arr (field 'id'), fallback to 1
  const nums = arr.map(x => {
    if (x && (typeof x.id === 'number' || typeof x.id === 'string')) {
      const n = Number(x.id);
      return Number.isInteger(n) ? n : NaN;
    }
    return NaN;
  }).filter(n => !Number.isNaN(n));
  return (nums.length ? Math.max(...nums) + 1 : 1);
}
function findById(arr, id) {
  // compare as number or string
  return arr.find(item => {
    if (item == null) return false;
    if (item.id == null) return false;
    return String(item.id) === String(id);
  });
}
function removeById(arr, id) {
  const idx = arr.findIndex(item => item && String(item.id) === String(id));
  if (idx >= 0) return arr.splice(idx, 1)[0];
  return null;
}

// Generic CRUD router factory (works on collections with 'id' field)
function makeRouter(collectionName) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const col = getCollection(collectionName);
    // optional simple query filter: ?id=1 or ?companyName=abc
    const q = req.query;
    if (Object.keys(q).length === 0) return res.json(col);
    const filtered = col.filter(item => {
      return Object.keys(q).every(k => {
        if (item[k] == null) return false;
        return String(item[k]).toLowerCase().includes(String(q[k]).toLowerCase());
      });
    });
    res.json(filtered);
  });

  router.get('/:id', (req, res) => {
    const id = req.params.id;
    const col = getCollection(collectionName);
    const found = findById(col, id);
    if (!found) return res.status(404).json({ error: `${collectionName} not found` });
    res.json(found);
  });

  router.post('/', (req, res) => {
    const col = getCollection(collectionName);
    const body = req.body || {};
    // ensure id exists
    if (body.id == null) {
      body.id = getNextId(col);
    }
    col.push(body);
    res.status(201).json(body);
  });

  router.patch('/:id', (req, res) => {
    const id = req.params.id;
    const col = getCollection(collectionName);
    const found = findById(col, id);
    if (!found) return res.status(404).json({ error: `${collectionName} not found` });
    Object.assign(found, req.body || {});
    res.json(found);
  });

  router.delete('/:id', (req, res) => {
    const id = req.params.id;
    const col = getCollection(collectionName);
    const removed = removeById(col, id);
    if (!removed) return res.status(404).json({ error: `${collectionName} not found` });
    res.json({ success: true, removed });
  });

  return router;
}

// Mount routers
app.use('/api/companies', makeRouter('companies'));
app.use('/api/cities', makeRouter('cities'));
app.use('/api/tags', makeRouter('tags'));
app.use('/api/jobs', makeRouter('jobs'));
app.use('/api/cvs', makeRouter('cvs'));

// Optional: endpoint để reset server-side data từ seed.json (dùng cho demo)
app.post('/api/_reset', (req, res) => {
  try {
    const raw = fs.readFileSync(seedPath, 'utf8');
    const parsed = JSON.parse(raw);
    db.companies = Array.isArray(parsed.companies) ? parsed.companies.slice() : [];
    db.cities = Array.isArray(parsed.cities) ? parsed.cities.slice() : [];
    db.tags = Array.isArray(parsed.tags) ? parsed.tags.slice() : [];
    db.jobs = Array.isArray(parsed.jobs) ? parsed.jobs.slice() : [];
    db.cvs = Array.isArray(parsed.cvs) ? parsed.cvs.slice() : [];
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Export handler for Vercel
module.exports = serverless(app);
