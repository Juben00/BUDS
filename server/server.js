'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { validate } = require('./validate');
const { sendSampleRequest, verifyTransport } = require('./mailer');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const PRODUCTION = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.disable('x-powered-by');

const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin(origin, done) {
    if (!origin) return done(null, true);
    return ALLOWED.includes(origin.replace(/\/$/, ''))
      ? done(null, true)
      : done(new Error('Origin not allowed'));
  },
  methods: ['POST', 'OPTIONS'],
}));

app.use(express.json({ limit: '32kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again shortly.' },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/sample', limiter, async (req, res) => {
  const result = validate(req.body);

  // Honeypot tripped: report success to the bot and send nothing.
  if (result.spam) return res.status(202).json({ ok: true });

  if (!result.ok) {
    return res.status(400).json({ ok: false, errors: result.errors });
  }

  try {
    const messageId = await sendSampleRequest(result.data);
    console.log('[sample] sent %s for %s <%s>',
      messageId, result.data.company, result.data.email);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Transport errors can include hostnames and credentials, so keep them server-side.
    console.error('[sample] send failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'Could not send your request. Please try again or email us directly.',
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err && err.message);
  const status = /Origin not allowed/.test(err && err.message) ? 403 : 500;
  res.status(status).json({
    ok: false,
    error: PRODUCTION ? 'Request could not be processed.' : String(err && err.message),
  });
});

app.listen(PORT, async () => {
  console.log(`sample mailer listening on :${PORT}`);
  console.log('allowed origins:', ALLOWED.length ? ALLOWED.join(', ') : '(none configured)');
  try {
    await verifyTransport();
    console.log('SMTP transport verified');
  } catch (err) {
    console.warn('SMTP not ready:', err && err.message);
    console.warn('Copy .env.example to .env and fill in the credentials.');
  }
});
