// server/plugins/mongoose.server.ts
import { connectDB } from '../utils/dbConnect'

export default defineNitroPlugin(async () => {
  await connectDB()
})