#!/usr/bin/env node
// Lists upstream commits since a baseline whose subject or touched files suggest
// security relevance, so we notice their fixes without merging their features.
//
// Baseline lives in .github/upstream-watch-state and moves forward only when a
// run has been reviewed, so nothing is silently skipped.
//
// Usage:
//   node scripts/check-upstream-security.mjs                 # uses the state file
//   node scripts/check-upstream-security.mjs <baseline-sha>  # ad hoc, e.g. to replay history
//   node scripts/check-upstream-security.mjs --json

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const UPSTREAM = 'https://github.com/curiousgeorgios/linear-gratis.git'
const STATE_FILE = '.github/upstream-watch-state'

// Two tiers so the weekly report stays readable. A watcher nobody reads is worse
// than no watcher, so broad-but-plausible terms are separated from certain ones.
const CERTAIN = /\b(security|vulnerab\w*|CVE-\d|GHSA|XSS|CSRF|SSRF|injection|hardening|bypass|RLS|sanitis\w*|sanitiz\w*)\b/i
const WORTH_A_LOOK = /\b(auth\w*|token|secret|password|permission\w*|escap\w*|leak\w*|expos\w*|oracle|rate.?limit\w*)\b/i

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

function ensureUpstream() {
  const remotes = git(['remote']).split('\n')
  if (!remotes.includes('upstream')) {
    execFileSync('git', ['remote', 'add', 'upstream', UPSTREAM])
  }
  execFileSync('git', ['fetch', '--quiet', 'upstream', 'main'])
}

function baseline() {
  const fromArg = process.argv.find((a) => /^[0-9a-f]{7,40}$/i.test(a))
  if (fromArg) return fromArg
  if (!existsSync(STATE_FILE)) {
    throw new Error(`${STATE_FILE} is missing. Seed it with the upstream SHA already reviewed.`)
  }
  const sha = readFileSync(STATE_FILE, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#'))
  if (!sha) throw new Error(`${STATE_FILE} contains no SHA.`)
  return sha.trim()
}

// A commit is only interesting if it touches a file this fork still has. After
// the divergence a lot of upstream code has no counterpart here.
function ourFiles(files) {
  return files.filter((f) => f && existsSync(f))
}

function classify(subject, files) {
  const migration = files.some((f) => f.startsWith('supabase/migrations/'))
  if (CERTAIN.test(subject)) return 'certain'
  if (migration && WORTH_A_LOOK.test(subject)) return 'certain'
  if (WORTH_A_LOOK.test(subject)) return 'look'
  if (migration) return 'look'
  return null
}

ensureUpstream()
const base = baseline()
const head = git(['rev-parse', '--short', 'upstream/main'])

const raw = git([
  'log', '--no-merges', '--format=%x00%h%x1f%ad%x1f%s', '--date=short', '--name-only',
  `${base}..upstream/main`,
])

const commits = raw
  .split('\0')
  .filter(Boolean)
  .map((block) => {
    const [meta, ...rest] = block.split('\n')
    const [sha, date, subject] = meta.split('\x1f')
    const files = rest.filter(Boolean)
    return { sha, date, subject, files }
  })

const hits = []
for (const c of commits) {
  const tier = classify(c.subject, c.files)
  if (!tier) continue
  const shared = ourFiles(c.files)
  hits.push({ ...c, tier, shared })
}

const certain = hits.filter((h) => h.tier === 'certain')
const look = hits.filter((h) => h.tier === 'look')

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ base, head, total: commits.length, certain, look }, null, 2))
  process.exit(0)
}

if (hits.length === 0) {
  console.log(`No security-relevant upstream commits. Scanned ${commits.length} commit(s) ${base}..${head}.`)
  console.log(`NEW_STATE=${head}`)
  process.exit(0)
}

const line = (h) => {
  const files = h.shared.length
    ? h.shared.slice(0, 6).map((f) => `\`${f}\``).join(', ') + (h.shared.length > 6 ? ` +${h.shared.length - 6} more` : '')
    : '_no files we still have_'
  return `- \`${h.sha}\` ${h.date} — ${h.subject}\n  - touches here: ${files}`
}

console.log(`Scanned ${commits.length} upstream commit(s) in \`${base}..${head}\`.\n`)
if (certain.length) {
  console.log(`## Security (${certain.length})\n`)
  console.log(certain.map(line).join('\n'))
  console.log()
}
if (look.length) {
  console.log(`## Worth a look (${look.length})\n`)
  console.log(look.map(line).join('\n'))
  console.log()
}
console.log(`Review, port what applies, then set \`${STATE_FILE}\` to \`${head}\`.`)
console.log(`NEW_STATE=${head}`)
