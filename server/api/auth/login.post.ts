import User from '../../models/User'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  // Find user by username
  const user = await User.findOne({ username })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Check password
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }
// Create tokens
const accessToken = jwt.sign(
  { 
    id: user._id, 
    userId: user._id, 
    username: user.username, 
    role: user.role,
    firmId: user.firmId 
  }, 
  ACCESS_TOKEN_SECRET, 
  { expiresIn: '15m' }
)
const refreshToken = jwt.sign({ id: user._id, username: user.username }, REFRESH_TOKEN_SECRET, { expiresIn: '30d' })
const csrfToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

const isDev = process.env.NODE_ENV !== 'production'

// Set cookies
setHeader(event, 'Set-Cookie', [
  serialize('access_token', accessToken, {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 // 15 minutes
  }),
  serialize('refresh_token', refreshToken, {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  }),
  serialize('csrf_token', csrfToken, {
    httpOnly: false,
    secure: !isDev,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60
  })
])
  return {
    message: 'Login successful',
    user: {
      id: user._id,
      username: user.username,
      fullname: user.fullname,
      role: user.role
    }
  }
})