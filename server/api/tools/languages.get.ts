// server/api/tools/languages.get.ts
import { defineEventHandler, getRequestIP, createError } from 'h3';

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 30; // Adjust as needed
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Comprehensive list of supported languages
// This is a static list to avoid API calls for languages which rarely change
const SUPPORTED_LANGUAGES = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hy', name: 'Armenian' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'eu', name: 'Basque' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'ceb', name: 'Cebuano' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'co', name: 'Corsican' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'et', name: 'Estonian' },
  { code: 'tl', name: 'Filipino' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Frisian' },
  { code: 'gl', name: 'Galician' },
  { code: 'ka', name: 'Georgian' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'iw', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hmn', name: 'Hmong' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ig', name: 'Igbo' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ga', name: 'Irish' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jw', name: 'Javanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'ko', name: 'Korean' },
  { code: 'ku', name: 'Kurdish (Kurmanji)' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'lo', name: 'Lao' },
  { code: 'la', name: 'Latin' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'ms', name: 'Malay' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mt', name: 'Maltese' },
  { code: 'mi', name: 'Maori' },
  { code: 'mr', name: 'Marathi' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'my', name: 'Myanmar (Burmese)' },
  { code: 'ne', name: 'Nepali' },
  { code: 'no', name: 'Norwegian' },
  { code: 'or', name: 'Odia (Oriya)' },
  { code: 'ps', name: 'Pashto' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sm', name: 'Samoan' },
  { code: 'gd', name: 'Scots Gaelic' },
  { code: 'sr', name: 'Serbian' },
  { code: 'st', name: 'Sesotho' },
  { code: 'sn', name: 'Shona' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'so', name: 'Somali' },
  { code: 'es', name: 'Spanish' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sw', name: 'Swahili' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tg', name: 'Tajik' },
  { code: 'ta', name: 'Tamil' },
  { code: 'tt', name: 'Tatar' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ug', name: 'Uyghur' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zu', name: 'Zulu' }
];

export default defineEventHandler(async (event) => {
  try {
    // Apply rate limiting
    const ip = getRequestIP(event) || 'unknown';

    // Check if this IP is already being rate limited
    const now = Date.now();
    const rateLimit = rateLimits.get(ip);

    if (rateLimit) {
      // If the reset time has passed, reset the counter
      if (now > rateLimit.resetTime) {
        rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      } else {
        // Increment the counter
        rateLimit.count++;

        // If the counter exceeds the limit, return a 429 error
        if (rateLimit.count > MAX_REQUESTS_PER_MINUTE) {
          const retryAfterSeconds = Math.ceil((rateLimit.resetTime - now) / 1000);

          // Set rate limit headers
          event.node.res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE.toString());
          event.node.res.setHeader('X-RateLimit-Remaining', '0');
          event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());
          event.node.res.setHeader('Retry-After', retryAfterSeconds.toString());

          throw createError({
            statusCode: 429,
            statusMessage: `Too Many Requests. Try again in ${retryAfterSeconds} seconds.`
          });
        }
      }
    } else {
      // First request from this IP
      rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    }

    // Set rate limit headers
    const currentLimit = rateLimits.get(ip);
    if (currentLimit) {
      event.node.res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE.toString());
      event.node.res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_MINUTE - currentLimit.count).toString());
      event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(currentLimit.resetTime / 1000).toString());
    }

    console.log('Returning static language list');

    // Set cache headers to improve performance
    event.node.res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Add provider information
    return SUPPORTED_LANGUAGES.map(lang => ({
      ...lang,
      provider: 'Static List'
    }));
  } catch (error: any) {
    console.error('Error in languages API:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    });
  }
});
