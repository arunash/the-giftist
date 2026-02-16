import Database from 'better-sqlite3'
import pg from 'pg'

const SQLITE_PATH = './prisma/dev.db'
const PG_URL = process.env.DATABASE_URL

if (!PG_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sqlite = new Database(SQLITE_PATH, { readonly: true })
const pool = new pg.Pool({ connectionString: PG_URL })

// DateTime column names (from Prisma schema)
const DATETIME_COLS = new Set([
  'emailVerified', 'createdAt', 'updatedAt', 'birthday', 'expires',
  'addedAt', 'purchasedAt', 'recordedAt', 'date', 'thankYouSentAt',
  'processedAt', 'currentPeriodEnd',
])

// Boolean column names
const BOOLEAN_COLS = new Set([
  'isAnonymous', 'isPurchased', 'isPublic', 'stripeConnectOnboarded',
])

function convertValue(col, val) {
  if (val === null || val === undefined) return null

  // Convert epoch ms to ISO timestamp for DateTime columns
  if (DATETIME_COLS.has(col) && typeof val === 'number') {
    return new Date(val).toISOString()
  }

  // Convert 0/1 to boolean
  if (BOOLEAN_COLS.has(col) && (val === 0 || val === 1)) {
    return val === 1
  }

  return val
}

// Tables in dependency order
const TABLES = [
  'User',
  'Account',
  'Session',
  'VerificationToken',
  'Item',
  'Event',
  'EventItem',
  'Contribution',
  'GiftList',
  'GiftListItem',
  'Wallet',
  'WalletTransaction',
  'Subscription',
  'ChatMessage',
  'ActivityEvent',
  'WhatsAppMessage',
  'PriceHistory',
  'ApiCallLog',
  'ErrorLog',
]

async function migrate() {
  const client = await pool.connect()

  try {
    // Clear existing data in reverse order
    console.log('Clearing existing Neon data...')
    for (const table of [...TABLES].reverse()) {
      await client.query(`DELETE FROM "${table}"`)
    }

    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
      if (rows.length === 0) {
        console.log(`${table}: 0 rows (skip)`)
        continue
      }

      const columns = Object.keys(rows[0])
      const quotedCols = columns.map(c => `"${c}"`).join(', ')

      let inserted = 0
      let errors = 0
      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`)
        const params = columns.map(col => convertValue(col, row[col]))

        try {
          await client.query(
            `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders.join(', ')})`,
            params
          )
          inserted++
        } catch (err) {
          errors++
          if (errors <= 3) {
            console.error(`  Error in ${table}: ${err.message}`)
          }
        }
      }
      console.log(`${table}: ${inserted}/${rows.length} rows migrated${errors > 0 ? ` (${errors} errors)` : ''}`)
    }

    console.log('\nMigration complete!')
  } finally {
    client.release()
    await pool.end()
    sqlite.close()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
