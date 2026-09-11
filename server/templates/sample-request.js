'use strict';

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const DISPLAY = "'Haettenschweiler','Arial Narrow',Impact,Charcoal,sans-serif";
const BODY = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const C = {
  navy: '#224289', ink: '#17224A', red: '#DE1F35', yellow: '#F7C51E',
  coral: '#F3817D', cream: '#FFF9F2', line: '#EDE6DC', muted: '#6B7089',
  body: '#3B4262', white: '#FFFFFF',
};

const CONTACT_FIELDS = [
  ['email', 'Email'], ['phone', 'Phone'], ['iAmA', 'They are a'],
];
const BUSINESS_FIELDS = [
  ['company', 'Company'], ['businessSubType', 'Business type'],
  ['website', 'Website'], ['address', 'Street address'],
  ['city', 'City'], ['region', 'State / region'],
  ['buyingGroup', 'Buying group'], ['distributor', 'Preferred distributor'],
];

const has = (data, key) => data[key] !== undefined && data[key] !== null && data[key] !== '';

function detailRows(data, fields) {
  return fields
    .filter(([key]) => has(data, key))
    .map(([key, label]) => `
            <tr>
              <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${BODY};font-size:13px;color:${C.muted};width:170px;vertical-align:top">${escapeHtml(label)}</td>
              <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${BODY};font-size:14px;color:${C.ink};font-weight:600;word-break:break-word">${escapeHtml(data[key])}</td>
            </tr>`)
    .join('');
}

function productChips(products) {
  return products.map((p) => `
              <td style="padding:0 8px 8px 0" valign="top">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:${C.yellow};border-radius:6px;padding:7px 12px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.ink};white-space:nowrap">${escapeHtml(p)}</td>
                </tr></table>
              </td>`).join('');
}

function renderSampleRequest(data) {
  const name = `${data.firstName} ${data.lastName}`.trim();
  const where = [data.city, data.region].filter(Boolean).join(', ');
  const subject = `Sample request — ${data.company}${where ? ` (${where})` : ''}`;

  const preheader = `${name} at ${data.company} — ${data.products.length} product${data.products.length === 1 ? '' : 's'}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
    <tr>
      <td align="center" style="padding:28px 14px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.white};border:2px solid ${C.line};border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:${C.navy};padding:22px 28px;">
              <div style="font-family:${DISPLAY};font-size:24px;letter-spacing:1.5px;text-transform:uppercase;color:${C.white};">
                LOVE <span style="color:${C.yellow};">BUDS</span>
              </div>
              <div style="font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#AEBBE0;padding-top:5px;">
                New sample request
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px 4px;">
              <div style="font-family:${DISPLAY};font-size:26px;line-height:1.15;text-transform:uppercase;color:${C.ink};">${escapeHtml(data.company)}</div>
              <div style="font-family:${BODY};font-size:14px;color:${C.body};padding-top:6px;">
                ${escapeHtml(name)}${where ? ` &middot; ${escapeHtml(where)}` : ''}
              </div>
              ${has(data, 'intent') ? `<div style="font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.red};padding-top:10px;">${escapeHtml(data.intent)}</div>` : ''}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};border-radius:10px;">
                <tr><td style="padding:16px 18px;">
                  <div style="font-family:${BODY};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.navy};padding-bottom:10px;">Products to try (${data.products.length})</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${productChips(data.products)}</tr></table>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px 0;">
              <div style="font-family:${BODY};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.navy};border-bottom:2px solid ${C.coral};padding-bottom:8px;">Contact</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows(data, CONTACT_FIELDS)}</table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 28px 0;">
              <div style="font-family:${BODY};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.navy};border-bottom:2px solid ${C.coral};padding-bottom:8px;">Business</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows(data, BUSINESS_FIELDS)}</table>
            </td>
          </tr>

          ${has(data, 'notes') ? `
          <tr>
            <td style="padding:24px 28px 0;">
              <div style="font-family:${BODY};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.navy};padding-bottom:8px;">Notes</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:${C.cream};border-left:3px solid ${C.yellow};border-radius:0 8px 8px 0;padding:14px 16px;font-family:${BODY};font-size:14px;line-height:1.6;color:${C.body};white-space:pre-wrap;">${escapeHtml(data.notes)}</td></tr>
              </table>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:26px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:${C.red};border-radius:8px;">
                  <a href="mailto:${escapeHtml(data.email)}?subject=${encodeURIComponent('Re: your BUDS sample request')}"
                     style="display:inline-block;padding:13px 24px;font-family:${BODY};font-size:14px;font-weight:700;color:${C.white};text-decoration:none;">
                    Reply to ${escapeHtml(data.firstName)}
                  </a>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream};border-top:1px solid ${C.line};padding:16px 28px;font-family:${BODY};font-size:12px;color:${C.muted};">
              Sent from the request form on welovebuds.com${has(data, 'receivedAt') ? ` &middot; ${escapeHtml(data.receivedAt)}` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const line = (label, value) => `${label}: ${value}`;
  const textParts = [
    'NEW SAMPLE REQUEST',
    '='.repeat(40),
    '',
    data.company,
    `${name}${where ? ` — ${where}` : ''}`,
  ];
  if (has(data, 'intent')) textParts.push(`Request type: ${data.intent}`);
  textParts.push('', `PRODUCTS (${data.products.length})`, ...data.products.map((p) => `  - ${p}`), '');
  textParts.push('CONTACT');
  CONTACT_FIELDS.filter(([k]) => has(data, k)).forEach(([k, l]) => textParts.push('  ' + line(l, data[k])));
  textParts.push('', 'BUSINESS');
  BUSINESS_FIELDS.filter(([k]) => has(data, k)).forEach(([k, l]) => textParts.push('  ' + line(l, data[k])));
  if (has(data, 'notes')) textParts.push('', 'NOTES', data.notes);
  if (has(data, 'receivedAt')) textParts.push('', `Received: ${data.receivedAt}`);
  textParts.push('', 'Sent from the request form on welovebuds.com');

  return { subject, html, text: textParts.join('\n') };
}

module.exports = { renderSampleRequest, escapeHtml };
