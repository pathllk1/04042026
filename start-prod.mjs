import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from root directory
dotenv.config({ path: path.join(__dirname, '.env') })

// Log loaded environment
console.log('✓ Environment loaded from .env')
console.log(`✓ MongoDB URI: ${process.env.MONGO_URI ? 'Configured' : 'NOT FOUND'}`)
console.log(`✓ JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'NOT FOUND'}`)

// Start the server
import('./.output/server/index.mjs').catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
