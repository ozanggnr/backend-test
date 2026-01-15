import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { MongoClient, ObjectId } from 'mongodb'
import axios from 'axios'
import crypto from 'crypto'

dotenv.config()



const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

const mongoUri = process.env.MONGODB_URI
const dbName = process.env.DB_NAME || 'bestBefore_TestDB'
const roomsCollectionName = process.env.COLLECTION_ROOMS || 'AryaColl'
const usersCollectionName = process.env.COLLECTION_USERS || 'Users'

const client = new MongoClient(mongoUri)
let rooms
let users

async function init() {
  await client.connect()
  const db = client.db(dbName)
  rooms = db.collection(roomsCollectionName)
  users = db.collection(usersCollectionName) // <-- must be here
  await users.createIndex({ email: 1 }, { unique: true })
  console.log('Connected to MongoDB, DB:', dbName, 'Collections:', roomsCollectionName, usersCollectionName)
}

app.get('/health', (req, res) => res.json({ ok: true }))

// GET /rooms
init().then(() => {
  const port = Number(process.env.PORT) || 3000
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
}).catch(err => {
  console.error('Failed to init server', err)
  process.exit(1)
})


// Helper: create JWT
function signToken(payload) {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

// Helper: validate phone number using BigDataCloud API
async function validatePhoneNumber(phoneNumber, countryCode) {
  try {
    const apiKey = process.env.BIGDATACLOUD_API_KEY
    const response = await axios.get('https://api-bdc.net/data/phone-number-validate', {
      params: {
        number: phoneNumber,
        countryCode: countryCode,
        localityLanguage: 'en',
        key: apiKey
      }
    })
    return response.data
  } catch (error) {
    console.error('Phone validation error:', error.message)
    return null
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// Helper: basic email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Middleware: auth (for /me)
function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// POST /signup
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, countryCode } = req.body

    // Email validation
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Please enter a valid email' })
    if (!validateEmail(email)) return res.status(400).json({ error: 'Please enter a valid email' })

    // Password validation
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' })
    }

    // Phone validation (if provided)
    let validatedPhone = null
    if (phone && countryCode) {
      const phoneValidation = await validatePhoneNumber(phone, countryCode)
      if (!phoneValidation || !phoneValidation.isValid) {
        return res.status(400).json({
          error: 'invalid phone number',
          details: phoneValidation ? `Phone number is not valid for ${countryCode}` : 'Phone validation service unavailable'
        })
      }
      // Store phone in E.164 format
      validatedPhone = phoneValidation.e164Format
    }

    const displayName = typeof name === 'string' ? name.trim() : null

    const existing = await users.findOne({ email })
    if (existing) return res.status(409).json({ error: 'email already in use' })

    const passwordHash = await bcrypt.hash(password, 10)
    const doc = {
      name: displayName,
      email,
      passwordHash,
      phone: validatedPhone,
      createdAt: new Date()
    }
    const result = await users.insertOne(doc)

    const verifyToken = generateToken()

await users.updateOne(
  { _id: result.insertedId },
  {
    $set: {
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
    }
  }
)

console.log(
  `VERIFY EMAIL LINK: http://localhost:3000/auth/verify-email?token=${verifyToken}`
)


    // Optionally auto-login after signup:
    const token = signToken({ userId: result.insertedId.toString(), email })
    res.json({
      user: {
        id: result.insertedId.toString(),
        name: displayName,
        email,
        phone: validatedPhone
      },
      token
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to sign up' })
  }
})

// POST /login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

    const user = await users.findOne({ email })
    if (!user) return res.status(401).json({ error: 'invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    const token = signToken({ userId: user._id.toString(), email: user.email })
    res.json({
      user: { id: user._id.toString(), name: user.name ?? null, email: user.email },
      token
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to login' })
  }
})

// GET /me
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 0 } })
    if (!user) return res.status(404).json({ error: 'not found' })
    res.json({ user: { id: user._id.toString(), name: user.name ?? null, email: user.email, createdAt: user.createdAt } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Protect these routes
app.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const docs = await rooms.find({ ownerId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray()
    res.json(docs)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

app.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const { userId, email } = req.user
    const { name } = req.body
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' })
    }
    const doc = {
      name,
      ownerId: new ObjectId(userId),
      ownerEmail: email ?? null, // optional convenience
      createdAt: new Date()
    }
    const result = await rooms.insertOne(doc)
    res.json({ id: result.insertedId.toString() })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create room' })
  }
  app.get('/auth/verify-email', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Invalid token' })

  const user = await users.findOne({
    emailVerifyToken: token,
    emailVerifyExpires: { $gt: new Date() }
  })

  if (!user) {
    return res.status(400).json({ error: 'Token expired or invalid' })
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { emailVerified: true },
      $unset: { emailVerifyToken: '', emailVerifyExpires: '' }
    }
  )

  res.json({ ok: true })
})
app.post('/auth/password-reset-request', async (req, res) => {
  const { email } = req.body

  const user = await users.findOne({ email })
  if (!user) return res.json({ ok: true }) // no info leak

  const token = generateToken()

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 1000 * 60 * 30)
      }
    }
  )

  console.log(
    `RESET PASSWORD LINK: http://localhost:5173/reset-password?token=${token}`
  )

  res.json({ ok: true })
})
app.post('/auth/password-reset', async (req, res) => {
  const { token, newPassword } = req.body

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Weak password' })
  }

  const user = await users.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  })

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired token' })
  }

  const hash = await bcrypt.hash(newPassword, 10)

  await users.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: hash },
      $unset: { passwordResetToken: '', passwordResetExpires: '' }
    }
  )

  res.json({ ok: true })
})

})

