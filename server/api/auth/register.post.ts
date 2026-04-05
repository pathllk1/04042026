import User from '../../models/User'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, fullname, email, password, firmId } = body

  if (!username || !fullname || !email || !password || !firmId) {
    throw createError({ statusCode: 400, statusMessage: 'All fields are required' })
  }

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await User.create({ username, fullname, email, password: hashedPassword, firmId })

  return { 
    message: 'User registered successfully', 
    user: { 
      id: user._id, 
      email: user.email, 
      fullname: user.fullname 
    } 
  }
})