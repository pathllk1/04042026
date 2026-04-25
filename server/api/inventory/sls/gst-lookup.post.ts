/**
 * server/api/inventory/sls/gst-lookup.post.ts
 * POST /api/inventory/sls/gst-lookup
 *
 * Proxies a GSTIN lookup to the external RapidAPI GST verification service.
 * POST is used (not GET) because:
 *   1. The request includes a CSRF token (state-changing contract)
 *   2. The GSTIN should not appear in server access logs as a URL query param
 *
 * Body:
 *   gstin   string   15-character GSTIN — REQUIRED
 *
 * The response shape from the upstream API is forwarded as-is under `data`.
 * The frontend's usePartyManager.extractPartyFieldsFromGSTData() knows
 * how to parse it.
 *
 * Required runtime config (nuxt.config.ts → runtimeConfig):
 *   rapidApiKey   string   RapidAPI subscription key
 *   rapidApiHost  string   default 'gst-verification.p.rapidapi.com'
 *
 * Auth: event.context.user
 */

import { getFirmId } from '../../../utils/billUtils'
import { validateGSTIN } from '../../../utils/gstCalculator'

export default defineEventHandler(async (event) => {
  // Auth check — firm must be valid
  getFirmId(event)

  const body  = await readBody(event)
  const gstin = String(body?.gstin || '').trim().toUpperCase()

  // ── Validate GSTIN format ──────────────────────────────────────────────
  if (!gstin || gstin.length !== 15) {
    throw createError({
      statusCode: 400,
      message:    'Please enter a valid 15-character GSTIN',
    })
  }

  if (!validateGSTIN(gstin)) {
    throw createError({
      statusCode: 400,
      message:    `"${gstin}" is not a valid GSTIN format`,
    })
  }

  // ── Resolve API credentials ────────────────────────────────────────────
  const config   = useRuntimeConfig()
  const apiKey   = (config.rapidApiKey  as string) || process.env.RAPID_API_KEY  || ''
  const apiHost  = (config.rapidApiHost as string) || process.env.RAPID_API_HOST || 'gst-verification.p.rapidapi.com'

  if (!apiKey) {
    throw createError({
      statusCode: 503,
      message:    'GST lookup service is not configured. Add RAPID_API_KEY to your environment.',
    })
  }

  // ── Call RapidAPI ──────────────────────────────────────────────────────
  let upstreamData: any
  try {
    const response = await $fetch<any>(
      `https://${apiHost}/gstin/${gstin}`,
      {
        method:  'GET',
        headers: {
          'x-rapidapi-key':  apiKey,
          'x-rapidapi-host': apiHost,
        },
      },
    )
    upstreamData = response
  } catch (err: any) {
    console.error('[gst-lookup] Upstream API error:', err?.message ?? err)

    // Surface a clean error to the client
    const status = err?.response?.status || err?.statusCode || 502
    throw createError({
      statusCode: status === 404 ? 404 : 502,
      message:    status === 404
        ? `GSTIN "${gstin}" not found in the GST registry`
        : 'Failed to reach the GST lookup service. Please try again.',
    })
  }

  // ── Validate upstream response ─────────────────────────────────────────
  // The API returns { sts: 'Active'|'Inactive', ... } on success.
  // A missing or inactive status means the GSTIN exists but is suspended.
  if (!upstreamData) {
    throw createError({ statusCode: 502, message: 'Empty response from GST lookup service' })
  }

  const status = String(upstreamData.sts || upstreamData.status || '').toLowerCase()
  const isActive = !status || status === 'active'  // treat unknown status as active

  return {
    success: true,
    active:  isActive,
    gstin,
    data:    upstreamData,
  }
})