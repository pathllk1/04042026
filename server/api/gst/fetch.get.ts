export default defineEventHandler(async (event) => {
  const gstin = getQuery(event).gstin as string

  if (!gstin) {
    throw createError({
      statusCode: 400,
      message: 'GSTIN is required'
    })
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
  if (!RAPIDAPI_KEY) {
    console.error('[GST_LOOKUP] RAPIDAPI_KEY is not set')
    throw createError({
      statusCode: 500,
      message: 'GST lookup service is not configured'
    })
  }

  try {
    const apiResponse = await fetch(
      `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com'
        }
      }
    )

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text()
      console.error(`[GST_LOOKUP] RapidAPI returned ${apiResponse.status}:`, errBody)
      throw createError({
        statusCode: 502,
        message: `GST lookup service returned an error (${apiResponse.status})`
      })
    }

    const raw = await apiResponse.json()
    return {
      success: true,
      data: raw?.data ?? raw
    }
  } catch (err: any) {
    console.error('[GST_LOOKUP] Error:', err)
    if (err.statusCode) throw err
    throw createError({
      statusCode: 500,
      message: 'Failed to reach GST lookup service'
    })
  }
})
