import { serialize } from 'cookie'

export default defineEventHandler((event) => {
  // Clear cookies by setting maxAge to -1
  setHeader(event, 'Set-Cookie', [
    serialize('access_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: -1
    }),
    serialize('refresh_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: -1
    })
  ])

  return { message: 'Logged out successfully' }
})
