/* Love BUDS — sample-request mailer.
   One endpoint: POST /api/sample. Receives the form payload from
   request-a-sample.html, validates it, and emails it to the foodservice team. */
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

app.set('trust proxy', 1);          /* rate limiting behind a proxy/CDN */
app.disable('x-powered-by');

/* Only the site may post here. An unlisted origin is refused outright rather
   than silently accepted. */
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin(origin, done) {
    if (!origin) return done(null, true);          /* curl, server-to-server */
    return ALLOWED.includes(origin.replace(/\/$/, ''))
      ? done(null, true)
      : done(new Error('Origin not allowed'));
  },
  methods: ['POST', 'OPTIONS'],
}));

/* A sample request is small; anything larger is not a sample request. */
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

  /* Bots get a normal-looking success and nothing is sent. */
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
    /* Log the detail, return none of it: transport errors quote credentials
       and hostnames. */
    console.error('[sample] send failed:', err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'Could not send your request. Please try again or email us directly.',
    });
  }
});

/* Anything unhandled, including the CORS rejection above. */
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
