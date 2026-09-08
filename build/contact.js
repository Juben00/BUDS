#!/usr/bin/env node
/* ==========================================================================
   Love BUDS — contact section + footer socials generator

   contact.json is the source of truth. Like the rest of the site, the pages
   are self-contained (no external fetch, so they work straight off the
   filesystem), so the markup is written in at build time.

   Run after any edit to contact.json:   node build/contact.js

   Regions rewritten, each delimited by
   <!-- @generated:NAME --> … <!-- /@generated:NAME -->:

     contact          the contact card on index.html
     footer-socials   the social row in every page footer

   A channel whose "value" is null is skipped, so unconfirmed details (a phone
   number nobody has published, an address sourced from a directory rather
   than from the brand) stay in the file without being published.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');   /* site root: the HTML lives here */
const dir = root;                          /* pages are read from the root  */
const dataDir = path.join(root, 'data');   /* JSON sources of truth         */
const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'contact.json'), 'utf8'));

/* ---- helpers ------------------------------------------------------------ */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function replaceRegion(source, name, body) {
  const open = '<!-- @generated:' + name + ' -->';
  const close = '<!-- /@generated:' + name + ' -->';
  const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* Capture the open marker's indentation so the close marker keeps it. */
  const re = new RegExp('([ \\t]*)' + rx(open) + '[\\s\\S]*?' + rx(close));
  const m = source.match(re);
  if (!m) return null;
  return source.replace(re, m[1] + open + '\n' + body + '\n' + m[1] + close);
}

const icon = (id, cls) =>
  '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#' + esc(id) + '"/></svg>';

/* A channel is a link when we can act on it, plain text when we cannot. */
function href(ch) {
  if (ch.type === 'email') return 'mailto:' + ch.value;
  if (ch.type === 'phone') return 'tel:' + String(ch.value).replace(/[^\d+]/g, '');
  if (ch.type === 'link') return ch.value;
  return null;
}

/* ---- contact card ------------------------------------------------------- */

function channelRow(ch, pad) {
  const to = href(ch);
  const tag = to ? 'a' : 'div';
  const open = to
    ? '<a class="contact-row" href="' + esc(to) + '">'
    : '<div class="contact-row">';

  const lines = [
    pad + open,
    pad + '  <span class="contact-ico">' + icon(ch.icon || 'i-mail') + '</span>',
    pad + '  <span class="contact-main">',
    pad + '    <span class="contact-label">' + esc(ch.label) + '</span>',
    pad + '    <span class="contact-value">' + esc(ch.display || ch.value) + '</span>'
  ];
  if (ch.note) lines.push(pad + '    <span class="contact-note">' + esc(ch.note) + '</span>');
  lines.push(pad + '  </span>');
  if (to) lines.push(pad + '  ' + icon('i-arrow', 'contact-go'));
  lines.push(pad + '</' + tag + '>');
  return lines.join('\n');
}

function socialLinks(pad) {
  return data.socials.map((s) =>
    pad + '<a href="' + esc(s.url) + '" class="social" target="_blank" rel="noopener"' +
    ' aria-label="' + esc(s.label) + '">' + icon(s.icon) + '</a>'
  ).join('\n');
}

function contactCard() {
  const shown = data.channels.filter((c) => c.value);
  const h = data.heading;
  const inv = data.invite;

  return [
    '        <div class="contact-card reveal">',
    '          <div class="panel">',
    '            <h2 id="contact-title" class="h2">' + esc(h.lead) +
      ' <span class="mark-red">' + esc(h.accent) + '</span></h2>',
    '            <p class="copy" style="margin-top:14px">' + esc(data.intro) + '</p>',
    '            <div class="contact-list">',
    shown.map((c) => channelRow(c, '              ')).join('\n'),
    '            </div>',
    '          </div>',
    '          <div class="contact-aside surface-navy">',
    '            <div>',
    '              <p class="meta">Follow BUDS</p>',
    '              <div class="socials">',
    socialLinks('                '),
    '              </div>',
    '              <p class="contact-handle">' + esc(data.socials[0].handle) + '</p>',
    '            </div>',
    '            <div class="contact-invite">',
    '              <h3 class="h3">' + esc(inv.title) + '</h3>',
    '              <p class="copy" style="margin-top:10px">' + esc(inv.copy) + '</p>',
    '              <a href="' + esc(inv.href) + '" class="btn btn-yellow" style="margin-top:22px">' +
      esc(inv.label) + '</a>',
    '            </div>',
    '          </div>',
    '        </div>'
  ].join('\n');
}

/* ---- write -------------------------------------------------------------- */

const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
const changed = [];
const untouched = [];
const skipped = [];

pages.forEach((page) => {
  const file = path.join(dir, page);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;

  const footer = replaceRegion(html, 'footer-socials', socialLinks('            '));
  if (footer === null) { skipped.push(page); return; }
  html = footer;

  /* Only the page that carries the section has this region. */
  const card = replaceRegion(html, 'contact', contactCard());
  if (card !== null) html = card;

  if (html === before) { untouched.push(page); return; }
  fs.writeFileSync(file, html);
  changed.push(page);
});

const pending = data.channels.filter((c) => !c.value).map((c) => c.label);

console.log(
  'contact built from contact.json — ' + data.channels.filter((c) => c.value).length +
  ' of ' + data.channels.length + ' channels shown, ' + data.socials.length + ' socials\n' +
  '  rewritten:   ' + (changed.length ? changed.join(', ') : '(none)') + '\n' +
  '  already ok:  ' + (untouched.length ? untouched.join(', ') : '(none)') +
  (pending.length ? '\n  awaiting a value: ' + pending.join(', ') : '') +
  (skipped.length ? '\n  no markers:  ' + skipped.join(', ') : '')
);
