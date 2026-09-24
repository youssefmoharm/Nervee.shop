#!/usr/bin/env node
/**
 * SEO artifact gate: public/sitemap.xml + public/robots.txt.
 *
 * Fails (exit 1) when:
 *  - sitemap.xml is missing, empty, or contains no <url>/<loc> entries
 *  - robots.txt is missing, lacks a `Sitemap:` line, or lacks `Disallow: /admin/`
 *
 * Run after build (prebuild generates the sitemap):
 *   node scripts/verify-seo.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const errors = [];
const fail = msg => errors.push(msg);

// --- sitemap.xml -----------------------------------------------------------
const sitemapPath = resolve('public/sitemap.xml');
if (!existsSync(sitemapPath)) {
  fail('public/sitemap.xml is missing (run `node scripts/generate-sitemap.mjs`)');
} else if (statSync(sitemapPath).size === 0) {
  fail('public/sitemap.xml is empty');
} else {
  const xml = readFileSync(sitemapPath, 'utf8');
  const urlCount = (xml.match(/<url>/g) || []).length;
  const locCount = (xml.match(/<loc>/g) || []).length;
  if (urlCount === 0) fail('public/sitemap.xml has no <url> entries');
  if (locCount === 0) fail('public/sitemap.xml has no <loc> entries');
}

// --- robots.txt ------------------------------------------------------------
const robotsPath = resolve('public/robots.txt');
if (!existsSync(robotsPath)) {
  fail('public/robots.txt is missing');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/^Sitemap:\s*\S+/im.test(robots)) {
    fail('public/robots.txt is missing a `Sitemap:` line');
  }
  if (!/^Disallow:\s*\/admin\/\s*$/im.test(robots)) {
    fail('public/robots.txt is missing `Disallow: /admin/`');
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log('✓ SEO checks passed (sitemap.xml + robots.txt)');
