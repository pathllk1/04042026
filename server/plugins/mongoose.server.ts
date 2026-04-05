// server/plugins/mongoose.server.ts
import { connectDB } from '../config/mongoose'

export default defineNitroPlugin(async () => {
  await connectDB()
})