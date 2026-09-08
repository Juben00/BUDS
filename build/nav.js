#!/usr/bin/env node
/* ==========================================================================
   Love BUDS — site header / navbar generator

   nav.json is the source of truth for the header bar. The pages are
   self-contained (no external fetch, so they work straight off the
   filesystem), which means the navbar has to be written into the markup.
   This script does that.

   Run after any edit to nav.json:   node build/nav.js

   It rewrites three regions in every *.html that carries the markers, each
   delimited by <!-- @generated:NAME --> … <!-- /@generated:NAME -->:

     nav-brand   the logo link (with its wordmark fallback)
     nav-links   the primary <nav> links, aria-current set per page
     nav-cta     the header call-to-action button

   It also toggles the hidden attribute on any element carrying
   data-nav-section="<href>", so a section follows the visibility of the nav
   link it belongs to.

   Everything outside those markers is left alone. A page whose filename
   matches a link href gets aria-current="page" on that link; pages that are
   not in the nav (request-a-sample.html) simply get none.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');   /* site root: the HTML lives here */
const dir = root;                          /* pages are read from the root  */
const dataDir = path.join(root, 'data');   /* JSON sources of truth         */
const nav = JSON.parse(fs.readFileSync(path.join(dataDir, 'nav.json'), 'utf8'));

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

/* ---- regions ------------------------------------------------------------ */

function brandBlock() {
  const b = nav.brand;
  const mark = b.wordmark || {};
  return [
    '      <a href="' + esc(b.href) + '" class="logo" aria-label="' + esc(b.ariaLabel) + '">',
    '        <img src="' + esc(b.logo) + '" alt="' + esc(b.logoAlt) + '"' +
      ' onerror="this.hidden=true;this.nextElementSibling.hidden=false" />',
    '        <span class="logo-text" hidden aria-hidden="true">' +
      '<span class="love">' + esc(mark.love || '') + '</span>' +
      '<span class="buds">' + esc(mark.buds || '') + '</span></span>',
    '      </a>'
  ].join('\n');
}

/* JSON has no comment syntax, so a link is parked with "hidden": true rather
   than deleted — the entry stays in nav.json, ready to be switched back on. */
const visible = () => nav.links.filter((l) => !l.hidden);

function linksBlock(page) {
  return visible().map((l) => {
    const current = l.href === page ? ' aria-current="page"' : '';
    return '        <a href="' + esc(l.href) + '" class="nav-link"' + current + '>' +
      esc(l.label) + '</a>';
  }).join('\n');
}

/* A bare "#anchor" href points at a section on the home page: keep it local on
   index.html, prefix it everywhere else so the link still lands. */
function resolveHref(href, page) {
  if (!href.startsWith('#')) return href;
  return page === 'index.html' ? href : 'index.html' + href;
}

function ctaBlock(page) {
  const c = nav.cta;
  if (!c) return '';
  return '        <a href="' + esc(resolveHref(c.href, page)) + '" class="' +
    esc(c.class || 'btn btn-coral btn-sm') + '">' + esc(c.label) + '</a>';
}

/* ---- sections tied to a nav link ---------------------------------------- */

/* An element marked data-nav-section="<href>" follows that link's visibility:
   park the link with "hidden": true in nav.json and the section it belongs to
   is hidden with it; set the link back to visible and the section returns.
   The markup itself is never touched, only the hidden attribute on it. */
const SECTION_TAG = /<([a-z]+)((?:[^>]*?)\sdata-nav-section="([^"]+)"(?:[^>]*?))>/gi;

function applySectionVisibility(html, note) {
  return html.replace(SECTION_TAG, (full, tag, attrs, href) => {
    const link = nav.links.find((l) => l.href === href);
    const hide = !link || !!link.hidden;
    const bare = attrs.replace(/\s+hidden(?=\s|$)/gi, '');
    note(href, hide);
    return '<' + tag + bare + (hide ? ' hidden' : '') + '>';
  });
}

/* ---- write -------------------------------------------------------------- */

const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
const changed = [];
const untouched = [];
const skipped = [];
const sections = [];
const hiddenLinks = nav.links.filter((l) => l.hidden).map((l) => l.label);

pages.forEach((page) => {
  const file = path.join(dir, page);
  const before = fs.readFileSync(file, 'utf8');

  let html = replaceRegion(before, 'nav-brand', brandBlock());
  if (html === null) { skipped.push(page); return; }

  const links = replaceRegion(html, 'nav-links', linksBlock(page));
  if (links === null) throw new Error(page + ': missing @generated:nav-links markers');
  html = links;

  const cta = replaceRegion(html, 'nav-cta', ctaBlock(page));
  if (cta === null) throw new Error(page + ': missing @generated:nav-cta markers');
  html = cta;

  html = applySectionVisibility(html, (href, hide) => {
    sections.push(page + ' → ' + href + (hide ? ' (hidden)' : ' (shown)'));
  });

  if (html === before) { untouched.push(page); return; }
  fs.writeFileSync(file, html);
  changed.push(page);
});

console.log(
  'navbar built from nav.json — ' + visible().length + ' of ' + nav.links.length + ' links shown' +
  (nav.cta ? ' + CTA "' + nav.cta.label + '"' : '') + '\n' +
  '  rewritten:   ' + (changed.length ? changed.join(', ') : '(none)') + '\n' +
  '  already ok:  ' + (untouched.length ? untouched.join(', ') : '(none)') +
  (hiddenLinks.length ? '\n  hidden:      ' + hiddenLinks.join(', ') : '') +
  (sections.length ? '\n  sections:    ' + sections.join(', ') : '') +
  (skipped.length ? '\n  no markers:  ' + skipped.join(', ') : '')
);
