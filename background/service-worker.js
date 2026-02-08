/**
 * The Giftist - Service Worker
 * Handles background tasks: context menu, price checking, notifications
 */

// Default storage values
const DEFAULT_STORAGE = {
  giftist: [],
  categories: ['Birthday', 'Christmas', 'Just For Me'],
  shareId: null,
  account: null,
  itemCount: 0,
  events: [],
  settings: {
    priceCheckEnabled: true,
    notificationsEnabled: true
  }
};

/**
 * Generate a unique ID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('The Giftist installed:', details.reason);

  // Create context menu
  chrome.contextMenus.create({
    id: 'addToGiftist',
    title: 'Add to Giftist',
    contexts: ['page', 'link', 'image']
  });

  // Initialize storage with defaults if first install
  if (details.reason === 'install') {
    const storage = await chrome.storage.sync.get(null);
    if (!storage.giftist) {
      await chrome.storage.sync.set(DEFAULT_STORAGE);
    }
  }

  // Set up price check alarm (runs daily)
  chrome.alarms.create('priceCheck', {
    periodInMinutes: 60 * 24 // Once per day
  });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToGiftist') {
    try {
      // Get product info from content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProductInfo' });

      if (response && response.name) {
        await addItemToGiftist(response);
        showNotification('Added to Giftist', response.name);
      } else {
        showNotification('Could not detect product', 'Try clicking the extension icon on a product page.');
      }
    } catch (error) {
      console.error('Error adding from context menu:', error);
      showNotification('Error', 'Could not add this page. Make sure you\'re on a product page.');
    }
  }
});

/**
 * Add item to giftist storage
 */
async function addItemToGiftist(productInfo) {
  const storage = await chrome.storage.sync.get(['giftist', 'itemCount']);
  const items = storage.giftist || [];

  const newItem = {
    id: generateId(),
    name: productInfo.name || 'Unknown Product',
    price: productInfo.price || null,
    priceValue: productInfo.priceValue || null,
    priceHistory: productInfo.priceValue ? [{
      price: productInfo.priceValue,
      date: new Date().toISOString().split('T')[0]
    }] : [],
    image: productInfo.image || null,
    url: productInfo.url,
    domain: productInfo.domain || new URL(productInfo.url).hostname,
    category: null,
    addedAt: new Date().toISOString()
  };

  items.unshift(newItem);

  await chrome.storage.sync.set({
    giftist: items,
    itemCount: items.length
  });

  // Update badge if we have price drops
  await updateBadge();

  return newItem;
}

/**
 * Handle alarms (price checking)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    await checkPrices();
  }
});

/**
 * Check prices for all items
 */
async function checkPrices() {
  const storage = await chrome.storage.sync.get(['giftist', 'settings']);

  if (!storage.settings?.priceCheckEnabled) return;

  const items = storage.giftist || [];
  let priceDropCount = 0;

  for (const item of items) {
    try {
      // Fetch the product page
      const response = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) continue;

      const html = await response.text();
      const newPrice = extractPriceFromHtml(html);

      if (newPrice !== null && newPrice !== item.priceValue) {
        const today = new Date().toISOString().split('T')[0];

        item.priceHistory = item.priceHistory || [];
        item.priceHistory.push({ price: newPrice, date: today });
        item.priceValue = newPrice;
        item.price = formatPrice(newPrice);

        if (newPrice < (item.priceHistory[0]?.price || Infinity)) {
          priceDropCount++;
        }
      }
    } catch (error) {
      console.log('Price check failed for:', item.url);
    }
  }

  // Save updated items
  await chrome.storage.sync.set({ giftist: items });

  // Update badge
  await updateBadge();

  // Notify about price drops
  if (priceDropCount > 0) {
    showNotification(
      'Price Drops!',
      `${priceDropCount} item${priceDropCount > 1 ? 's' : ''} in your Giftist dropped in price!`
    );
  }
}

/**
 * Extract price from HTML content
 */
function extractPriceFromHtml(html) {
  // Try JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const content = match.replace(/<[^>]*>/g, '');
        const data = JSON.parse(content);
        const price = findPriceInJsonLd(data);
        if (price !== null) return price;
      } catch (e) {
        // Continue to next match
      }
    }
  }

  // Try meta tags
  const priceMatch = html.match(/property="product:price:amount"\s+content="([^"]+)"/);
  if (priceMatch) {
    return parseFloat(priceMatch[1]);
  }

  // Try common price patterns
  const pricePatterns = [
    /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+\.?\d*)/i,
    /itemprop="price"[^>]*content="([\d.]+)"/i,
    /\$\s*([\d,]+\.?\d{2})/
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }

  return null;
}

/**
 * Find price in JSON-LD data
 */
function findPriceInJsonLd(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const price = findPriceInJsonLd(item);
      if (price !== null) return price;
    }
    return null;
  }

  if (data['@type'] === 'Product' && data.offers) {
    const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
    if (offers.price) return parseFloat(offers.price);
    if (offers.lowPrice) return parseFloat(offers.lowPrice);
  }

  if (data['@graph']) {
    return findPriceInJsonLd(data['@graph']);
  }

  return null;
}

/**
 * Format price with currency symbol
 */
function formatPrice(price) {
  return '$' + price.toFixed(2);
}

/**
 * Update extension badge with price drop count
 */
async function updateBadge() {
  const storage = await chrome.storage.sync.get(['giftist']);
  const items = storage.giftist || [];

  const priceDrops = items.filter(item => {
    if (!item.priceHistory || item.priceHistory.length < 2) return false;
    return item.priceValue < item.priceHistory[0].price;
  });

  if (priceDrops.length > 0) {
    chrome.action.setBadgeText({ text: String(priceDrops.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#00B894' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Show notification
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkPrices') {
    checkPrices().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'updateBadge') {
    updateBadge().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'exportGiftlist') {
    exportGiftlist().then(data => sendResponse(data));
    return true;
  }
});

/**
 * Export giftlist for sharing
 */
async function exportGiftlist() {
  const storage = await chrome.storage.sync.get(['giftist', 'categories', 'shareId']);

  return {
    items: storage.giftist || [],
    categories: storage.categories || [],
    shareId: storage.shareId,
    exportedAt: new Date().toISOString()
  };
}

// Initialize badge on startup
chrome.runtime.onStartup.addListener(updateBadge);
