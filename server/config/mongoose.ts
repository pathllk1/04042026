// server/config/mongoose.ts
import mongoose from 'mongoose'

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/myapp'

export const connectDB = async () => {
  try {
    await mongoose.connect(mongoUri)
    console.log('✅ MongoDB connected:', mongoUri)
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

// Optional: listen to events
mongoose.connection.on('connected', () => console.log('MongoDB connection established'))
mongoose.connection.on('error', err => console.error('MongoDB connection error:', err))
mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'))