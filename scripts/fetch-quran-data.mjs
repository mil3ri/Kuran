/**
 * Pre-fetches all Quran data from the DIB API and saves it as static JSON files
 * under public/data/ so that the static export can serve them without a server.
 *
 * Usage:
 *   DIB_KURAN_API_BASE_URL=https://... DIB_KURAN_API_TOKEN=... node scripts/fetch-quran-data.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API_BASE_URL = process.env.DIB_KURAN_API_BASE_URL
const API_TOKEN = process.env.DIB_KURAN_API_TOKEN

if (!API_BASE_URL || !API_TOKEN) {
  console.error('❌  DIB_KURAN_API_BASE_URL and DIB_KURAN_API_TOKEN must be set.')
  process.exit(1)
}

const OUTPUT_DIR = join(process.cwd(), 'public', 'data', 'quran')

async function apiGet(path) {
  const url = `${API_BASE_URL}/api/v1${path}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `******
    },
  })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function save(relPath, data) {
  const filePath = join(OUTPUT_DIR, relPath)
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  await mkdir(dir, { recursive: true })
  await writeFile(filePath, JSON.stringify(data), 'utf8')
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(path, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await apiGet(path)
    } catch (err) {
      if (attempt === retries) throw err
      console.warn(`  ⚠  Attempt ${attempt} failed for ${path}: ${err.message}. Retrying…`)
      await sleep(delayMs * attempt)
    }
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  // 1. Chapters (all 114 surahs metadata)
  console.log('📖 Fetching chapters…')
  const chapters = await fetchWithRetry('/chapters')
  await save('chapters.json', chapters)
  console.log('  ✓ chapters.json saved')

  // 2. Each surah's verses
  console.log('📜 Fetching surahs (1–114)…')
  await mkdir(join(OUTPUT_DIR, 'surah'), { recursive: true })
  for (let id = 1; id <= 114; id++) {
    const data = await fetchWithRetry(`/chapters/${id}`)
    await save(`surah/${id}.json`, data)
    if (id % 10 === 0) console.log(`  … ${id}/114`)
    await sleep(100)
  }
  console.log('  ✓ All surahs saved')

  // 3. Each page's verses (604 pages in the Mushaf)
  console.log('📄 Fetching pages (1–604)…')
  await mkdir(join(OUTPUT_DIR, 'pages'), { recursive: true })
  for (let num = 1; num <= 604; num++) {
    const data = await fetchWithRetry(`/verses/page/${num}`)
    await save(`pages/${num}.json`, data)
    if (num % 50 === 0) console.log(`  … ${num}/604`)
    await sleep(100)
  }
  console.log('  ✓ All pages saved')

  console.log('\n✅ Done! All data saved to public/data/quran/')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
