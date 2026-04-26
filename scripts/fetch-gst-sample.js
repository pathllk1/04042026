#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const GSTIN = '19APJPD8428D1ZV'

if (!RAPIDAPI_KEY) {
  console.error('RAPIDAPI_KEY not found in .env')
  process.exit(1)
}

async function fetchGST() {
  try {
    console.log(`Fetching GST data for GSTIN: ${GSTIN}...`)
    
    const response = await fetch(
      `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${GSTIN}/details`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com'
        }
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error(`API Error ${response.status}:`, errText)
      process.exit(1)
    }

    const data = await response.json()
    
    const outputPath = path.join(__dirname, '../junk/gst-sample-response.json')
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
    
    console.log(`✓ GST data saved to: ${outputPath}`)
    console.log('\nResponse structure:')
    console.log(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

fetchGST()
