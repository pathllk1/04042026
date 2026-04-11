import { defineEventHandler, getQuery, createError } from 'h3';
import { XMLParser } from 'fast-xml-parser';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const topic = query.topic as string || 'Indian Politics';

  const topics: Record<string, string> = {
    'indian-politics': 'https://news.google.com/rss/search?q=Indian+Politics&hl=en-IN&gl=IN&ceid=IN:en',
    'world-politics': 'https://news.google.com/rss/search?q=World+Politics&hl=en-IN&gl=IN&ceid=IN:en',
    'indian-stock-market': 'https://news.google.com/rss/search?q=Indian+Stock+Market&hl=en-IN&gl=IN&ceid=IN:en',
    'indian-finance': 'https://news.google.com/rss/search?q=Indian+Finance&hl=en-IN&gl=IN&ceid=IN:en',
    'it-tech': 'https://news.google.com/rss/search?q=IT+and+Technology&hl=en-IN&gl=IN&ceid=IN:en'
  };

  const rssUrl = topics[topic] || topics['indian-politics'];

  try {
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.statusText}`);
    }

    const xmlData = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    
    const jsonObj = parser.parse(xmlData);
    const items = jsonObj.rss?.channel?.item || [];

    // Ensure items is an array
    const newsItems = Array.isArray(items) ? items : [items];

    // Sort by date descending
    newsItems.sort((a: any, b: any) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    return {
      success: true,
      topic,
      news: newsItems.map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: item.source?.['#text'] || item.source || 'Google News',
        description: item.description
      }))
    };
  } catch (error: any) {
    console.error('RSS Fetch Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch news: ${error.message}`
    });
  }
});
