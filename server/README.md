# Sample-request mailer

Receives the form on `request-a-sample.html` and emails it to the foodservice
team. The site itself stays static; this is the one small piece that needs a
server, because sending mail requires credentials and **credentials can never
live in the browser**.

```
server/
  server.js        POST /api/sample  — the only endpoint
  validate.js      allowlist, length caps, control-character stripping
  mailer.js        SMTP transport + message rendering
  .env.example     placeholders — copy to .env and fill in
```

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in the SMTP values
npm start
```

`.env` is git-ignored. Only `.env.example` is tracked, and it contains
placeholders only.

Check it is alive:

```bash
curl http://localhost:8787/health
```

## Point the form at it

In `request-a-sample.html`, find `var ENDPOINT = '';` and set it:

```js
var ENDPOINT = 'http://localhost:8787/api/sample';   // production: your deployed URL
```

While `ENDPOINT` is empty the form does not pretend to send: it hands the
visitor a pre-filled `mailto:` instead, so requests are never lost. Setting it
switches on the real pending / success / failure states.

Add the site's origin to `ALLOWED_ORIGINS` or the browser will block the POST.

## What the endpoint does

`POST /api/sample`, JSON body.

| Response | Meaning |
|---|---|
| `200 {ok:true}` | Sent |
| `202 {ok:true}` | Honeypot tripped — nothing sent, bot sees success |
| `400 {ok:false, errors:[…]}` | Validation failed |
| `403` | Origin not in `ALLOWED_ORIGINS` |
| `429` | Rate limited (default 5 per IP per 15 min) |
| `502 {ok:false, error:"…"}` | SMTP refused it |

## Security notes

- **No secrets in the repo.** Credentials come from `.env`; `.gitignore`
  excludes it and every `.env.*` except the example.
- **Nothing from the browser is trusted.** `validate.js` drops unknown keys,
  caps every length, and strips control characters — including CR/LF, which is
  what stops a crafted name injecting mail headers such as `Bcc:`.
- **Errors do not leak.** SMTP failures quote hostnames and sometimes
  credentials; those are logged server-side and the client gets a flat message.
- **CORS is an allowlist**, not `*`.
- Values are HTML-escaped into the message body.

## Deploying

Any Node host works — Render, Railway, Fly.io, a VPS. Set the same variables as
environment config rather than shipping a `.env` file.

If you move the site to Cloudflare Pages (worth considering — it also resolves
the Git LFS problem with the videos), this can become a Pages Function instead.
The validation logic ports as-is; swap `mailer.js` for an HTTP call to a
transactional email API, since Workers cannot open raw SMTP connections.
