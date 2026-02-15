/**
 * The Giftist - Backend API Client
 * Handles authenticated requests to the portal backend
 */

const PORTAL_URL = 'https://giftist.ai';

// Cookie names NextAuth may use (varies by environment)
const COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

/**
 * Get the NextAuth session token from portal cookies
 * Returns null if not logged in
 */
async function getSessionToken() {
  for (const name of COOKIE_NAMES) {
    try {
      const cookie = await chrome.cookies.get({
        url: PORTAL_URL,
        name: name,
      });
      if (cookie?.value) return cookie.value;
    } catch (e) {
      // Permission might not be available
    }
  }
  return null;
}

/**
 * Check if user is authenticated on the portal
 * Returns session object or null
 */
async function checkAuth() {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const res = await fetch(`${PORTAL_URL}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const session = await res.json();
    // NextAuth returns {} for no session
    return session?.user ? session : null;
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API request to the portal
 */
async function apiRequest(method, path, body) {
  const token = await getSessionToken();
  if (!token) throw new Error('Not authenticated');

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${PORTAL_URL}${path}`, options);

  if (res.status === 401) {
    throw new Error('Not authenticated');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Sync an item to the backend using server-side URL extraction.
 * Matches the portal's AddProductBar flow: dedup, server-side scrape, activity logging.
 * Returns the backend item (with id, extracted name, price, image).
 */
async function syncItemByUrl(url) {
  return apiRequest('POST', '/api/items/from-url', {
    url,
    source: 'EXTENSION',
  });
}

/**
 * Sync a locally saved item to the backend (fallback when URL extraction isn't possible)
 */
async function syncItem(item) {
  return apiRequest('POST', '/api/items', {
    name: item.name,
    price: item.price || null,
    priceValue: item.priceValue || null,
    image: item.image || null,
    url: item.url,
    domain: item.domain || new URL(item.url).hostname,
    category: item.category || null,
    source: 'EXTENSION',
  });
}

/**
 * Delete an item from the backend
 */
async function deleteItem(backendId) {
  return apiRequest('DELETE', `/api/items/${backendId}`);
}

/**
 * Fetch all items from the backend
 */
async function fetchItems() {
  return apiRequest('GET', '/api/items');
}

/**
 * Bulk sync all local extension items to the backend.
 * Uses server-side URL extraction (from-url) for consistency with portal flow.
 * Dedup is handled by the from-url endpoint.
 */
async function syncAllItems() {
  const localItems = await chrome.storage.sync.get({ giftist: [] });
  const items = localItems.giftist || [];
  if (items.length === 0) return { synced: 0, skipped: 0 };

  let synced = 0;
  let skipped = 0;
  const updatedItems = [...items];

  for (let i = 0; i < updatedItems.length; i++) {
    const item = updatedItems[i];
    if (item.backendId) {
      skipped++;
      continue;
    }
    try {
      // Use server-side extraction for consistency — endpoint handles dedup
      const backendItem = await syncItemByUrl(item.url);
      updatedItems[i] = { ...item, backendId: backendItem.id };
      synced++;
    } catch (e) {
      // Fallback to raw item sync if URL extraction fails
      try {
        const backendItem = await syncItem(item);
        updatedItems[i] = { ...item, backendId: backendItem.id };
        synced++;
      } catch (e2) {
        console.log('Failed to sync item:', item.name, e2.message);
      }
    }
  }

  // Save updated items with backendIds
  await chrome.storage.sync.set({ giftist: updatedItems });

  return { synced, skipped };
}

/**
 * Open the portal login page in a new tab
 */
function openLoginPage() {
  chrome.tabs.create({ url: `${PORTAL_URL}/login?source=extension` });
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.GiftistAPI = {
    PORTAL_URL,
    getSessionToken,
    checkAuth,
    apiRequest,
    syncItemByUrl,
    syncItem,
    syncAllItems,
    deleteItem,
    fetchItems,
    openLoginPage,
  };
}

// Also export for service worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.GiftistAPI = {
    PORTAL_URL,
    getSessionToken,
    checkAuth,
    apiRequest,
    syncItemByUrl,
    syncItem,
    syncAllItems,
    deleteItem,
    fetchItems,
    openLoginPage,
  };
}
