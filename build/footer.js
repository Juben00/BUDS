#!/usr/bin/env node
/* ==========================================================================
   Love BUDS — footer generator

   footer.json is the source of truth for the footer's link columns; the
   social row is generated separately from contact.json. The pages are
   self-contained (no external fetch, so they work straight off the
   filesystem), so the markup is written in at build time.

   Run after any edit to footer.json:   node build/footer.js

   Regions rewritten, each delimited by
   <!-- @generated:NAME --> … <!-- /@generated:NAME -->:

     footer-blurb   the one-line brand line under the logo
     footer-cols    the "Our Products" / "Quick Links" columns
     footer-subscribe the newsletter column heading and blurb
     footer-extra   the small link pair under the subscribe form
     footer-legal   the copyright line and legal links

   HIDDEN PAGES
   A link disappears from the footer when either:
     * the link itself carries "hidden": true in footer.json, or
     * its href matches a link in nav.json that is hidden.
   The second rule is the point: park a page once, in nav.json, and it leaves
   the navbar, its home-page section (via build-nav.js) and the footer
   together — no chance of a footer link outliving the page it points at.
   A column whose links all disappear is dropped rather than left as a
   heading with nothing under it.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');   /* site root: the HTML lives here */
const dir = root;                          /* pages are read from the root  */
const dataDir = path.join(root, 'data');   /* JSON sources of truth         */
const foot = JSON.parse(fs.readFileSync(path.join(dataDir, 'footer.json'), 'utf8'));
const nav = JSON.parse(fs.readFileSync(path.join(dataDir, 'nav.json'), 'utf8'));

/* Hrefs parked in nav.json — the single switch every surface reads. */
const navHidden = new Set(nav.links.filter((l) => l.hidden).map((l) => l.href));

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

const dropped = [];

function isVisible(link, where) {
  if (link.hidden) { dropped.push(link.label + ' (' + where + ', hidden in footer.json)'); return false; }
  if (navHidden.has(link.href)) { dropped.push(link.label + ' (' + where + ', page hidden in nav.json)'); return false; }
  return true;
}

const flink = (l, pad) =>
  pad + '<a href="' + esc(l.href) + '" class="flink">' + esc(l.label) + '</a>';

/* ---- regions ------------------------------------------------------------ */

function blurbBlock() {
  return '          <p class="copy" style="margin-top:18px;max-width:30ch;font-size:15.5px">' +
    esc(foot.blurb) + '</p>';
}

function colsBlock() {
  return foot.columns.map((col) => {
    const links = col.links.filter((l) => isVisible(l, col.title));
    if (!links.length) return null;
    return [
      '        <div>',
      '          <h2 class="col-title">' + esc(col.title) + '</h2>',
      '          <div class="links">',
      links.map((l) => flink(l, '            ')).join('\n'),
      '          </div>',
      '        </div>'
    ].join('\n');
  }).filter(Boolean).join('\n');
}

function subscribeBlock() {
  return [
    '          <h2 class="col-title">' + esc(foot.subscribe.title) + '</h2>',
    '          <p class="copy" style="margin-top:14px;font-size:15.5px">' + esc(foot.subscribe.copy) + '</p>'
  ].join('\n');
}

function extraBlock() {
  return foot.extra
    .filter((l) => isVisible(l, 'extra'))
    .map((l) => flink(l, '            '))
    .join('\n');
}

function legalBlock() {
  const links = foot.legal.links.filter((l) => isVisible(l, 'legal'));
  return [
    '        <span>' + esc(foot.legal.copyright) + '</span>',
    '        <div style="display:flex;gap:22px">',
    links.map((l) => '          <a href="' + esc(l.href) + '">' + esc(l.label) + '</a>').join('\n'),
    '        </div>'
  ].join('\n');
}

/* ---- write -------------------------------------------------------------- */

const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
const changed = [];
const untouched = [];
const skipped = [];

/* Build the bodies once; dropped[] is collected on that first pass. */
const bodies = {
  'footer-blurb': blurbBlock(),
  'footer-cols': colsBlock(),
  'footer-subscribe': subscribeBlock(),
  'footer-extra': extraBlock(),
  'footer-legal': legalBlock()
};
const droppedOnce = dropped.slice();

pages.forEach((page) => {
  const file = path.join(dir, page);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  let missing = false;

  Object.keys(bodies).forEach((name) => {
    if (missing) return;
    const next = replaceRegion(html, name, bodies[name]);
    if (next === null) { missing = true; return; }
    html = next;
  });

  if (missing) { skipped.push(page); return; }
  if (html === before) { untouched.push(page); return; }
  fs.writeFileSync(file, html);
  changed.push(page);
});

const shown = foot.columns.reduce((n, c) => n + c.links.length, 0) +
  foot.extra.length + foot.legal.links.length - droppedOnce.length;

console.log(
  'footer built from footer.json — ' + shown + ' links shown\n' +
  '  rewritten:   ' + (changed.length ? changed.join(', ') : '(none)') + '\n' +
  '  already ok:  ' + (untouched.length ? untouched.join(', ') : '(none)') +
  (droppedOnce.length ? '\n  dropped:     ' + droppedOnce.join(', ') : '') +
  (skipped.length ? '\n  no markers:  ' + skipped.join(', ') : '')
);
