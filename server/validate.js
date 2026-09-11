'use strict';

const TEXT_FIELDS = {
  firstName: 80, lastName: 80, email: 254, phone: 40,
  iAmA: 60, company: 120, website: 200, businessSubType: 60,
  region: 60, city: 80, address: 200,
  buyingGroup: 60, distributor: 60, intent: 80, notes: 2000,
};

const REQUIRED = ['firstName', 'lastName', 'email', 'company', 'region', 'city'];

const MAX_PRODUCTS = 40;
const MAX_PRODUCT_LEN = 120;

// Stripping CR/LF from single-line fields prevents mail header injection.
// Multi-line fields keep LF only.
const CONTROL_ALL = /[\x00-\x1F\x7F-\x9F]/g;
const CONTROL_KEEP_LF = /[\x00-\x09\x0B-\x1F\x7F-\x9F]/g;

const stripControl = (value, allowNewlines) =>
  String(value).replace(allowNewlines ? CONTROL_KEEP_LF : CONTROL_ALL, ' ');

const clean = (value, max, allowNewlines = false) =>
  stripControl(value, allowNewlines)
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  if (typeof body.hp === 'string' && body.hp.trim()) {
    return { ok: false, spam: true, errors: [] };
  }

  const data = {};
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const raw = body[field];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') {
      errors.push(`${field} must be text.`);
      continue;
    }
    data[field] = clean(raw, max, field === 'notes');
  }

  for (const field of REQUIRED) {
    if (!data[field]) errors.push(`${field} is required.`);
  }

  if (data.email && !EMAIL.test(data.email)) {
    errors.push('email is not a valid address.');
  }

  const products = Array.isArray(body.products) ? body.products : [];
  data.products = products
    .filter((p) => typeof p === 'string')
    .slice(0, MAX_PRODUCTS)
    .map((p) => clean(p, MAX_PRODUCT_LEN))
    .filter(Boolean);

  if (!data.products.length) errors.push('Select at least one product.');

  data.receivedAt = new Date().toISOString();

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

module.exports = { validate, TEXT_FIELDS, REQUIRED };
