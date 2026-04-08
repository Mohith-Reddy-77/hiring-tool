#!/usr/bin/env node
/*
  One-off script to create an ADMIN user in the Supabase `users` table
  Usage:
    node scripts/create-admin.js --email admin@example.com --password Secret123 --name "Site Admin"
*/
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })

function argv(key) {
  const idx = process.argv.findIndex((a) => a === `--${key}`)
  if (idx === -1) return null
  return process.argv[idx + 1]
}

async function main() {
  const email = argv('email')
  const password = argv('password')
  const name = argv('name') || 'Admin'
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js --email admin@example.com --password Secret123 --name "Site Admin"')
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase service key or URL not found in server/.env')
    process.exit(1)
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const hashed = await bcrypt.hash(password, 10)
  const payload = { name, email: email.toLowerCase(), role: 'ADMIN', password_hash: hashed, created_at: new Date() }
  try {
    const { data, error } = await client.from('users').upsert(payload).select()
    if (error) {
      console.error('Upsert error:', error)
      process.exit(1)
    }
    const row = data && data[0]
    console.log('Created/updated user:', { id: row.id, email: row.email, role: row.role })

    const jwtSecret = process.env.JWT_SECRET
    if (jwtSecret) {
      const token = jwt.sign({ sub: String(row.id), role: row.role }, jwtSecret, { expiresIn: '7d' })
      console.log('\nJWT token (use as Authorization: Bearer <token>):')
      console.log(token)
    } else {
      console.warn('JWT_SECRET not set in .env — cannot generate JWT. Use /api/auth/login to obtain a token.')
    }

    console.log('\nYou can also login via the API:')
    console.log(`curl -X POST http://localhost:${process.env.PORT || 5001}/api/auth/login -H "Content-Type: application/json" -d '{"email":"${email}","password":"${password}"}'`)
    process.exit(0)
  } catch (e) {
    console.error('Unexpected error:', e?.message || e)
    process.exit(1)
  }
}

main()
