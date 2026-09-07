#!/usr/bin/env node
/* ==========================================================================
   Love BUDS — products.html generator
   products.json is the source of truth. The pages are self-contained (no
   external fetch, so they work straight off the filesystem), which means the
   catalogue has to be written into the markup. This script does that.

   Run after any edit to products.json:   node pages/build-products.js

   It rewrites four regions of products.html, each delimited by
   <!-- @generated:NAME --> … <!-- /@generated:NAME -->. Everything outside
   those markers is left alone.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

/* Set to false to keep wholesale carton pricing off the public page.
   Pack sizes, carton weights and product codes still render. */
const SHOW_PRICES = true;

const dir = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'));
const htmlPath = path.join(dir, 'products.html');
const samplePath = path.join(dir, 'request-a-sample.html');
const indexPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
let sample = fs.readFileSync(samplePath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

/* ---- helpers ------------------------------------------------------------ */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (n) => (n === null || n === undefined)
  ? '—'
  : '$' + Number(n).toFixed(2).replace(/\.00$/, '');

const badgeClass = (badge) => {
  if (badge === 'Foodservice' || badge === 'vEEF®') return 'badge-navy';
  if (badge === 'New') return 'badge-red';
  return 'badge-white';
};

const TAG_TONES = ['', ' tag-yellow', ' tag-coral'];

function cardTags(p) {
  const tags = p.tags.slice(0, 2);
  if (p.isNew && p.pack.kgPerCarton) tags.push(p.pack.kgPerCarton + 'kg carton');
  return tags.slice(0, 3);
}

function replaceRegion(source, name, body) {
  const open = '<!-- @generated:' + name + ' -->';
  const close = '<!-- /@generated:' + name + ' -->';
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* Capture the open marker's indentation so the close marker keeps it. */
  const re = new RegExp('([ \\t]*)' + esc(open) + '[\\s\\S]*?' + esc(close));
  const m = source.match(re);
  if (!m) throw new Error('Missing @generated:' + name + ' markers');
  return source.replace(re, m[1] + open + '\n' + body + '\n' + m[1] + close);
}

/* The sample form has always used its own wording for a few products; that is
   what the customer picked from, so sampleLabel wins where it is set. */
const sampleName = (p) => p.sampleLabel || p.name;

/* ---- chips -------------------------------------------------------------- */

const chips = [
  '<button type="button" class="chip" data-cat-chip="All" aria-pressed="true">All</button>',
  '<button type="button" class="chip" data-cat-chip="New" aria-pressed="false">New</button>'
].concat(
  data.categories
    .filter((c) => c.label !== 'All')
    .map((c) => '<button type="button" class="chip" data-cat-chip="' + esc(c.label) + '" aria-pressed="false">' + esc(c.label) + '</button>')
).map((s) => '            ' + s).join('\n');

/* ---- product cards ------------------------------------------------------ */

function media(p) {
  if (p.image) {
    return '              <img src="' + esc(p.image) + '" alt="" loading="lazy" width="600" height="450" />';
  }
  /* Photography still to come — say so, rather than implying the format is all
     we have. Announced to screen readers because it is real product status. */
  if (p.comingSoon) {
    return '              <div class="pack-shot pack-shot-soon">\n'
      + '                <span class="plate"><span class="mark">Coming soon</span>'
      + '<span class="fmt">' + esc(p.pack.packDescription || 'Foodservice carton') + '</span></span>\n'
      + '              </div>';
  }
  /* No pack shot yet — a rotated label plate keeps the card intentional
     rather than empty, and states the format instead of faking a photo. */
  return '              <div class="pack-shot" aria-hidden="true">\n'
    + '                <span class="plate"><span class="mark">' + esc(p.brand === 'vEEF' ? 'vEEF®' : 'Love BUDS') + '</span>'
    + '<span class="fmt">' + esc(p.pack.packDescription || 'Foodservice carton') + '</span></span>\n'
    + '              </div>';
}

function card(p) {
  const tags = cardTags(p).map((t, i) => '<span class="tag' + TAG_TONES[i % 3] + '">' + esc(t) + '</span>').join('');
  return [
    '          <button type="button" class="card card-btn product-card reveal" data-product-card data-id="' + esc(p.id) + '" data-cat="' + esc(p.category) + '" data-new="' + (p.isNew ? 'true' : 'false') + '" aria-label="View details for ' + esc(p.name) + '">',
    '            <div class="tone ' + esc(p.tone) + '">',
    media(p),
    '              <span class="badge ' + badgeClass(p.badge) + ' badge-float">' + esc(p.badge) + '</span>',
    '            </div>',
    '            <div class="body">',
    '              <div class="head"><h3 class="h3">' + esc(p.name) + '</h3><span class="pack">' + esc(p.pack.packDescription || '—') + '</span></div>',
    '              <p class="copy">' + esc(p.copy) + '</p>',
    '              <div class="tags">' + tags + '</div>',
    '              <div class="foot"><span class="link-arrow">Discover more</span><span class="go" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span></div>',
    '            </div>',
    '          </button>'
  ].join('\n');
}

const grid = data.products.map(card).join('\n\n');

/* ---- foodservice specification table ------------------------------------ */

const specRows = data.products.filter((p) => p.price.perCarton !== null);

const specTable = [
  '          <div class="table table-spec reveal" role="table" aria-label="Foodservice specifications">',
  '            <div class="table-row table-head" role="row">',
  '              <span role="columnheader">Product</span>',
  '              <span role="columnheader">Code</span>',
  '              <span role="columnheader">Pack</span>',
  '              <span role="columnheader">Carton</span>',
  '              <span role="columnheader">' + (SHOW_PRICES ? 'Per carton' : 'Brand') + '</span>',
  '            </div>'
].concat(specRows.map((p) => [
  '            <div class="table-row" role="row">',
  '              <span class="name" role="cell">' + esc(p.name) + '</span>',
  '              <span class="code" role="cell">' + esc(p.sku) + '</span>',
  '              <span class="num" role="cell">' + esc(p.pack.packDescription) + '</span>',
  '              <span class="num" role="cell">' + esc(p.pack.kgPerCarton) + 'kg</span>',
  '              <span class="' + (SHOW_PRICES ? 'price' : 'num') + '" role="cell">' + (SHOW_PRICES ? money(p.price.perCarton) : esc(p.brand)) + '</span>',
  '            </div>'
].join('\n'))).concat(['          </div>']).join('\n');

/* ---- inline data for the detail modal ----------------------------------- */

const payload = 'window.BUDS_SHOW_PRICES=' + String(SHOW_PRICES) + ';'
  + 'window.BUDS_PRODUCTS=' + JSON.stringify(data.products).replace(/</g, '\\u003c') + ';';

/* ---- sample-request pills ------------------------------------------------ */

/* Grouped by category — a flat list of 33 pills is unscannable. */
const pillGroups = data.categories
  .filter((c) => c.label !== 'All')
  .map((c) => ({ label: c.label, items: data.products.filter((p) => p.category === c.label) }))
  .filter((g) => g.items.length);

const orphans = data.products.filter((p) => !pillGroups.some((g) => g.items.includes(p)));
if (orphans.length) throw new Error('Products in no pill group: ' + orphans.map((p) => p.id).join(', '));

const pills = pillGroups.map((g) => [
  '                <div class="pill-group">',
  '                  <div class="pill-group-head">',
  '                    <h3 class="pill-group-title">' + esc(g.label) + '</h3>',
  '                    <span class="pill-group-count">' + g.items.length + '</span>',
  '                  </div>',
  '                  <div class="pill-grid">'
].concat(g.items.map((p) =>
  '                    <button type="button" class="pill" data-sample-product="' + esc(sampleName(p)) + '" aria-pressed="false">'
  + '<span>' + esc(sampleName(p))
  + (p.pack.packDescription ? '<span class="pill-note">' + esc(p.pack.packDescription) + '</span>' : '')
  + '</span></button>'
)).concat([
  '                  </div>',
  '                </div>'
]).join('\n')).join('\n');

/* ---- home-page call-out -------------------------------------------------- */

/* The home page keeps its curated nine; this points at everything else.
   Named formats come from the data so the blurb can't go stale. */
const newProducts = data.products.filter((p) => p.isNew);
const HIGHLIGHTS = [
  { match: 'Schnitzel', label: 'schnitzels' },
  { match: 'Popper', label: 'cheese poppers' },
  { match: 'Meatball', label: 'meatballs' },
  { match: 'Drumstick', label: 'drumsticks' },
  { match: 'Falafel', label: 'falafel' }
];
const highlights = HIGHLIGHTS
  .filter((h) => newProducts.some((p) => p.name.indexOf(h.match) > -1))
  .map((h) => h.label);
if (newProducts.some((p) => p.brand === 'vEEF')) highlights.push('the vEEF® range');

const calloutBlurb = (highlights.slice(0, -1).join(', ') + ' and ' + highlights[highlights.length - 1]
  + ' — with pack formats, carton weights and product codes.')
  .replace(/^./, (c) => c.toUpperCase());

const callout = [
  '        <aside class="range-callout reveal" aria-labelledby="new-lines-title">',
  '          <span class="count" aria-hidden="true">' + newProducts.length + '</span>',
  '          <div class="txt">',
  '            <h3 id="new-lines-title" class="h3">New foodservice lines just landed</h3>',
  '            <p class="copy">' + esc(calloutBlurb) + '</p>',
  '          </div>',
  '          <a href="products.html#new" class="btn btn-red">See the new range</a>',
  '        </aside>'
].join('\n');

/* ---- write -------------------------------------------------------------- */

html = replaceRegion(html, 'chips', chips);
html = replaceRegion(html, 'grid', grid);
html = replaceRegion(html, 'spec-table', specTable);
html = replaceRegion(html, 'data', '<script>' + payload + '</script>');
sample = replaceRegion(sample, 'sample-pills', pills);
index = replaceRegion(index, 'new-lines', callout);

/* Counts that appear in prose stay in step with the data. */
html = html
  .replace(/(<span class="big">)\d+(<\/span>)/, '$1' + data.products.length + '$2')
  .replace(/(id="product-count">)[^<]*(<)/, '$1' + data.products.length + '$2')
  .replace(/(data-new-count>)[^<]*(<)/, '$1' + data.products.filter((p) => p.isNew).length + '$2');

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(samplePath, sample);
fs.writeFileSync(indexPath, index);

console.log(
  'products.html updated — ' + data.products.length + ' cards (' +
  newProducts.length + ' new), ' +
  specRows.length + ' spec rows, prices ' + (SHOW_PRICES ? 'shown' : 'hidden') + '.\n' +
  'request-a-sample.html updated — ' + data.products.length + ' pills in ' +
  pillGroups.length + ' groups.\n' +
  'index.html updated — call-out to ' + newProducts.length + ' new lines.'
);
