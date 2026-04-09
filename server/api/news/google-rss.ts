import { defineEventHandler, createError } from 'h3';
import { $fetch } from 'ofetch';
import { XMLParser } from 'fast-xml-parser';

// Google News RSS feed URL - using the exact URL provided
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';

// Cache for RSS feed data to avoid too many requests
interface NewsCache {
  data: any;
  timestamp: number;
  expiryTime: number;
}

let newsCache: NewsCache = {
  data: null,
  timestamp: 0,
  expiryTime: 15 * 60 * 1000 // 15 minutes in milliseconds
};

// Helper function to clean up description text
const cleanDescription = (description: string | undefined): string => {
  if (!description) return '';

  // Remove HTML comments
  let cleaned = description.replace(/<!--[\s\S]*?-->/g, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};

export default defineEventHandler(async (event) => {
  try {
    // No query parameters needed as we're using the direct URL

    // Check if we have valid cached data
    const now = Date.now();
    if (newsCache.data && (now - newsCache.timestamp < newsCache.expiryTime)) {
      console.log('Returning cached Google News RSS data');
      return newsCache.data;
    }

    // Use the direct URL without category filtering
    const rssUrl = GOOGLE_NEWS_RSS_URL;

    console.log(`Fetching Google News RSS from: ${rssUrl}`);

    // Fetch the RSS feed
    const xmlData = await $fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Parse XML to JSON
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      htmlEntities: true, // Preserve HTML entities
      processEntities: false, // Don't process HTML entities
    });

    const result = parser.parse(xmlData);

    // Extract the news items from the parsed data
    const channel = result.rss?.channel;

    if (!channel || !channel.item) {
      throw createError({
        statusCode: 404,
        message: 'No news items found in the RSS feed'
      });
    }

    // Ensure items is always an array
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    // Transform the data to a more usable format
    const newsItems = items.map((item: any) => {
      // Extract image URL from media:content if available
      const mediaContent = item['media:content'];
      let imageUrl = null;

      if (mediaContent) {
        if (Array.isArray(mediaContent)) {
          // If there are multiple media items, find an image
          const imageMedia = mediaContent.find(media =>
            media._medium === 'image' || (media._url && (
              media._url.endsWith('.jpg') ||
              media._url.endsWith('.jpeg') ||
              media._url.endsWith('.png')
            ))
          );
          if (imageMedia) {
            imageUrl = imageMedia._url;
          }
        } else if (mediaContent._url) {
          // If there's a single media item
          imageUrl = mediaContent._url;
        }
      }

      // Parse the publication date
      let publishedDate = null;
      try {
        publishedDate = new Date(item.pubDate).toISOString();
      } catch (e) {
        publishedDate = item.pubDate;
      }

      // Extract source from title or use default
      let source = 'Google News';
      const sourceSeparator = ' - ';
      if (item.title && item.title.includes(sourceSeparator)) {
        const parts = item.title.split(sourceSeparator);
        source = parts[parts.length - 1];
      }

      return {
        title: item.title ? cleanDescription(item.title.split(sourceSeparator)[0]) : 'No Title',
        description: cleanDescription(item.description) || 'No description available',
        link: item.link,
        url: item.link, // Add url property to match what the component expects
        publishedAt: publishedDate,
        source: source,
        urlToImage: imageUrl,
        guid: item.guid?.["#text"] || item.guid || item.link,
        category: 'general'
      };
    });

    // Create the response object
    const response = {
      status: 'ok',
      totalResults: newsItems.length,
      articles: newsItems
    };

    // Update the cache
    newsCache = {
      data: response,
      timestamp: now,
      expiryTime: 15 * 60 * 1000
    };

    return response;
  } catch (error: any) {
    console.error('Error fetching Google News RSS:', error);

    // Provide more detailed error information
    const errorDetails = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      url: GOOGLE_NEWS_RSS_URL
    };

    console.error('Error details:', errorDetails);

    throw createError({
      statusCode: 500,
      message: `Failed to fetch news: ${error.message || 'Unknown error'}`
    });
  }
});
