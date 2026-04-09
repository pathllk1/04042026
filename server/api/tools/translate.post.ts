// server/api/tools/translate.post.ts
import { defineEventHandler, readBody, createError, getRequestIP } from 'h3';

// MyMemory Translation API endpoint
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 30; // Adjust as needed
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Fallback simple translations for common phrases
const SIMPLE_TRANSLATIONS = {
  'en': {
    'hello': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'it': 'ciao', 'pt': 'olá', 'ru': 'привет', 'zh': '你好', 'ja': 'こんにちは' },
    'thank you': { 'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'it': 'grazie', 'pt': 'obrigado', 'ru': 'спасибо', 'zh': '谢谢', 'ja': 'ありがとう' },
    'goodbye': { 'es': 'adiós', 'fr': 'au revoir', 'de': 'auf wiedersehen', 'it': 'arrivederci', 'pt': 'adeus', 'ru': 'до свидания', 'zh': '再见', 'ja': 'さようなら' },
    'yes': { 'es': 'sí', 'fr': 'oui', 'de': 'ja', 'it': 'sì', 'pt': 'sim', 'ru': 'да', 'zh': '是', 'ja': 'はい' },
    'no': { 'es': 'no', 'fr': 'non', 'de': 'nein', 'it': 'no', 'pt': 'não', 'ru': 'нет', 'zh': '不', 'ja': 'いいえ' }
  }
};

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

    const body = await readBody(event);
    const { text, source, target } = body;

    if (!text || !target) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: text and target language'
      });
    }

    // Check if we can provide a simple translation for common phrases
    const lowerText = text.toLowerCase().trim();
    if (source && source !== 'auto' && SIMPLE_TRANSLATIONS[source]?.[lowerText]?.[target]) {
      console.log('Using built-in simple translation');
      return {
        translatedText: SIMPLE_TRANSLATIONS[source][lowerText][target],
        detectedLanguage: null,
        provider: 'built-in'
      };
    }

    // Prepare MyMemory API URL with query parameters
    // Ensure source language is properly formatted - default to 'en' if auto-detect
    const sourceCode = (source && source !== 'auto') ? source : 'en';

    // Format language pair according to MyMemory API requirements (always use a source language)
    const langPair = `${sourceCode}|${target}`;

    // Special handling for certain languages that might need specific formatting
    // MyMemory API is case-sensitive for language codes
    const formattedLangPair = langPair.toUpperCase();

    const apiUrl = new URL(MYMEMORY_API_URL);
    apiUrl.searchParams.append('q', text);
    apiUrl.searchParams.append('langpair', formattedLangPair);
    apiUrl.searchParams.append('de', 'your-email@example.com'); // Optional: add your email for higher rate limits

    console.log(`Attempting translation with MyMemory API: ${formattedLangPair}`);

    try {
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if we got a valid response
      if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
        console.error('Invalid response from MyMemory API:', data);

        // Check for specific error messages related to language pairs
        if (data.responseDetails && data.responseDetails.includes('INVALID LANGUAGE PAIR')) {
          console.log('Language pair error detected, trying with different format');
          throw new Error('Invalid language pair format');
        } else {
          throw new Error('Invalid response from translation service');
        }
      }

      // Extract the translated text
      const translatedText = data.responseData.translatedText;

      // Extract match information if available
      let matchQuality = null;
      if (data.responseData.match) {
        matchQuality = parseFloat(data.responseData.match);
      }

      console.log(`Successfully translated with MyMemory API (match: ${matchQuality || 'unknown'})`);

      return {
        translatedText,
        matchQuality,
        provider: 'MyMemory',
        detectedLanguage: source === 'auto' ? { language: data.responseData.detectedLanguage, confidence: 0.9 } : null
      };
    } catch (apiError) {
      console.error('MyMemory API error:', apiError);

      // Try Google Translate API as a fallback (using a free proxy)
      try {
        console.log('Attempting fallback translation with Google Translate proxy');

        // Format language codes for Google Translate
        const googleSource = source === 'auto' ? 'auto' : source;

        // Use a free Google Translate proxy
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${googleSource}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

        const googleResponse = await fetch(googleUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!googleResponse.ok) {
          throw new Error(`Google Translate proxy error: ${googleResponse.statusText}`);
        }

        const googleData = await googleResponse.json();

        // Google Translate returns a nested array structure
        if (googleData && Array.isArray(googleData[0])) {
          let translatedText = '';

          // Concatenate all translated parts
          for (const part of googleData[0]) {
            if (part[0]) {
              translatedText += part[0];
            }
          }

          if (translatedText) {
            console.log('Successfully translated with Google Translate proxy');
            return {
              translatedText,
              provider: 'Google Translate (proxy)',
              detectedLanguage: googleSource === 'auto' && googleData[2] ?
                { language: googleData[2], confidence: 0.7 } : null
            };
          }
        }

        throw new Error('Failed to parse Google Translate response');
      } catch (googleError) {
        console.error('Google Translate proxy error:', googleError);

        // If all translation services fail, try one more approach with a different proxy
        try {
          console.log('Attempting last-resort translation with alternative proxy');

          const proxyUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(formattedLangPair)}&mt=1`;

          const proxyResponse = await fetch(proxyUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          });

          if (!proxyResponse.ok) {
            throw new Error(`Alternative proxy error: ${proxyResponse.statusText}`);
          }

          const proxyData = await proxyResponse.json();

          if (proxyData.responseData?.translatedText) {
            console.log('Successfully translated with alternative proxy');
            return {
              translatedText: proxyData.responseData.translatedText,
              provider: 'Alternative Proxy',
              detectedLanguage: null
            };
          }

          throw new Error('Failed to get translation from alternative proxy');
        } catch (proxyError) {
          console.error('Alternative proxy error:', proxyError);

          // If we have a simple translation dictionary for the source language, try to use it
          // even if it's not an exact match
          if (source && source !== 'auto' && SIMPLE_TRANSLATIONS[source as keyof typeof SIMPLE_TRANSLATIONS]) {
            // Try to find the closest match in our dictionary
            const words = lowerText.split(/\s+/);
            const translations = [];
            const sourceDictionary = SIMPLE_TRANSLATIONS[source as keyof typeof SIMPLE_TRANSLATIONS];

            for (const word of words) {
              // Type-safe access to the dictionary
              const wordTranslations = (sourceDictionary as any)[word];
              if (wordTranslations && wordTranslations[target]) {
                translations.push(wordTranslations[target]);
              } else {
                // Keep original word if no translation found
                translations.push(word);
              }
            }

            if (translations.length > 0) {
              const result = translations.join(' ');
              console.log('Using word-by-word fallback translation');
              return {
                translatedText: result,
                provider: 'word-by-word fallback',
                detectedLanguage: null
              };
            }
          }

          // If all else fails, throw an error
          throw createError({
            statusCode: 503,
            statusMessage: 'All translation services are currently unavailable. Please try again later.'
          });
        }
      }
    }
  } catch (error: any) {
    console.error('Translation error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error during translation'
    });
  }
});
