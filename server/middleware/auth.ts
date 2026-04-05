import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'
import User from '../models/User'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret'

export default defineEventHandler(async (event) => {
  const isDev = process.env.NODE_ENV !== 'production'
  const path = getRequestPath(event)
  const method = getMethod(event)

  // 1. Auth Route Skip
  const isAuthRoute = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register')
  if (isAuthRoute) return

  // 2. Token Verification and Refresh logic
  const cookies = parseCookies(event)
  const accessToken = cookies.access_token
  const refreshToken = cookies.refresh_token

  if (!accessToken && !refreshToken) return

  try {
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, ACCESS_TOKEN_SECRET) as any
        const userId = decoded.id || decoded.userId
        
        // Fetch full user from DB to ensure firmId and other metadata are current
        const user = await User.findById(userId).lean()
        if (user) {
          event.context.user = {
            ...user,
            id: user._id.toString()
          }
          event.context.userId = user._id.toString()
          return
        }
      } catch (err: any) {
        if (err.name !== 'TokenExpiredError') throw err
      }
    }

    if (refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any
        const userId = decodedRefresh.id || decodedRefresh.userId
        
        // Fetch full user from DB during refresh to get firmId/role
        const user = await User.findById(userId).lean()
        if (!user) {
          throw createError({ statusCode: 401, statusMessage: 'User not found' })
        }

        const newAccessToken = jwt.sign(
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

        appendHeader(event, 'Set-Cookie', serialize('access_token', newAccessToken, {
          httpOnly: true,
          secure: !isDev,
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60
        }))

        event.context.user = {
          ...user,
          id: user._id.toString()
        }
        event.context.userId = user._id.toString()
      } catch (err) {
        throw createError({ statusCode: 401, statusMessage: 'Session expired' })
      }
    } else {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  } catch (error) {
    appendHeader(event, 'Set-Cookie', serialize('access_token', '', { path: '/', maxAge: -1 }))
    appendHeader(event, 'Set-Cookie', serialize('refresh_token', '', { path: '/', maxAge: -1 }))
    if (path.startsWith('/api/')) throw error
  }
})
