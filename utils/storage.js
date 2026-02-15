/**
 * Storage utilities for The Giftist extension
 * Uses Chrome sync storage for cross-device syncing
 */

const DEFAULT_CATEGORIES = ['Birthday', 'Christmas', 'Just For Me'];

const DEFAULT_STORAGE = {
  giftist: [],
  categories: DEFAULT_CATEGORIES,
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
 * Get all data from storage
 */
async function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_STORAGE, (result) => {
      resolve(result);
    });
  });
}

/**
 * Set data in storage
 */
async function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => {
      resolve();
    });
  });
}

/**
 * Get all giftist items
 */
async function getItems() {
  const storage = await getStorage();
  return storage.giftist || [];
}

/**
 * Add a new item to the giftist
 */
async function addItem(item) {
  const storage = await getStorage();
  const items = storage.giftist || [];

  const newItem = {
    id: generateId(),
    backendId: item.backendId || null,
    name: item.name || 'Unknown Product',
    price: item.price || null,
    priceValue: item.priceValue || null,
    priceHistory: item.priceValue ? [{
      price: item.priceValue,
      date: new Date().toISOString().split('T')[0]
    }] : [],
    image: item.image || null,
    url: item.url,
    domain: item.domain || new URL(item.url).hostname,
    category: item.category || null,
    addedAt: new Date().toISOString()
  };

  items.unshift(newItem);

  await setStorage({
    giftist: items,
    itemCount: items.length
  });

  return { item: newItem, itemCount: items.length };
}

/**
 * Update an existing item
 */
async function updateItem(id, updates) {
  const storage = await getStorage();
  const items = storage.giftist || [];
  const index = items.findIndex(item => item.id === id);

  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await setStorage({ giftist: items });
    return items[index];
  }

  return null;
}

/**
 * Delete an item from the giftist
 */
async function deleteItem(id) {
  const storage = await getStorage();
  const items = storage.giftist || [];
  const filtered = items.filter(item => item.id !== id);

  await setStorage({
    giftist: filtered,
    itemCount: filtered.length
  });

  return filtered;
}

/**
 * Update item price and track history
 */
async function updateItemPrice(id, newPrice, newPriceValue) {
  const storage = await getStorage();
  const items = storage.giftist || [];
  const index = items.findIndex(item => item.id === id);

  if (index !== -1) {
    const item = items[index];
    const today = new Date().toISOString().split('T')[0];

    // Only add to history if price changed
    if (newPriceValue !== item.priceValue) {
      item.priceHistory = item.priceHistory || [];
      item.priceHistory.push({ price: newPriceValue, date: today });
      item.price = newPrice;
      item.priceValue = newPriceValue;

      await setStorage({ giftist: items });
      return { item, priceChanged: true };
    }
  }

  return { item: items[index], priceChanged: false };
}

/**
 * Get items with price drops
 */
async function getItemsWithPriceDrops() {
  const items = await getItems();
  return items.filter(item => {
    if (!item.priceHistory || item.priceHistory.length < 2) return false;
    const currentPrice = item.priceValue;
    const originalPrice = item.priceHistory[0].price;
    return currentPrice < originalPrice;
  });
}

/**
 * Get all categories
 */
async function getCategories() {
  const storage = await getStorage();
  return storage.categories || DEFAULT_CATEGORIES;
}

/**
 * Add a new category
 */
async function addCategory(category) {
  const storage = await getStorage();
  const categories = storage.categories || DEFAULT_CATEGORIES;

  if (!categories.includes(category)) {
    categories.push(category);
    await setStorage({ categories });
  }

  return categories;
}

/**
 * Delete a category
 */
async function deleteCategory(category) {
  const storage = await getStorage();
  const categories = storage.categories || DEFAULT_CATEGORIES;
  const filtered = categories.filter(c => c !== category);

  // Remove category from all items
  const items = storage.giftist || [];
  items.forEach(item => {
    if (item.category === category) {
      item.category = null;
    }
  });

  await setStorage({ categories: filtered, giftist: items });
  return filtered;
}

/**
 * Update a local item with its backend ID (for syncing deletes)
 */
async function updateItemBackendId(localId, backendId) {
  const storage = await getStorage();
  const items = storage.giftist || [];
  const index = items.findIndex(item => item.id === localId);

  if (index !== -1) {
    items[index].backendId = backendId;
    await setStorage({ giftist: items });
    return items[index];
  }

  return null;
}

/**
 * Update a local item with server-extracted data (better name, price, image)
 */
async function updateItemFromBackend(localId, backendItem) {
  const storage = await getStorage();
  const items = storage.giftist || [];
  const index = items.findIndex(item => item.id === localId);

  if (index !== -1) {
    items[index] = {
      ...items[index],
      backendId: backendItem.id,
      name: backendItem.name || items[index].name,
      price: backendItem.price || items[index].price,
      priceValue: backendItem.priceValue || items[index].priceValue,
      image: backendItem.image || items[index].image,
    };
    await setStorage({ giftist: items });
    return items[index];
  }

  return null;
}

/**
 * Merge backend items into local storage (for refresh/sync).
 * Adds new items from backend that aren't already stored locally.
 */
async function mergeBackendItems(backendItems) {
  const storage = await getStorage();
  const localItems = storage.giftist || [];
  const localBackendIds = new Set(localItems.map(i => i.backendId).filter(Boolean));
  const localUrls = new Set(localItems.map(i => i.url).filter(Boolean));

  let added = 0;
  for (const bi of backendItems) {
    // Skip if already tracked locally
    if (localBackendIds.has(bi.id)) continue;
    if (bi.url && localUrls.has(bi.url)) continue;

    localItems.unshift({
      id: generateId(),
      backendId: bi.id,
      name: bi.name || 'Unknown Product',
      price: bi.price || null,
      priceValue: bi.priceValue || null,
      priceHistory: bi.priceValue ? [{ price: bi.priceValue, date: new Date().toISOString().split('T')[0] }] : [],
      image: bi.image || null,
      url: bi.url || '',
      domain: bi.domain || '',
      category: bi.category || null,
      addedAt: bi.createdAt || new Date().toISOString(),
    });
    added++;
  }

  if (added > 0) {
    await setStorage({ giftist: localItems, itemCount: localItems.length });
  }

  return added;
}

/**
 * Get or create share ID
 */
async function getShareId() {
  const storage = await getStorage();

  if (!storage.shareId) {
    const shareId = generateId().substring(0, 8);
    await setStorage({ shareId });
    return shareId;
  }

  return storage.shareId;
}

/**
 * Get account info
 */
async function getAccount() {
  const storage = await getStorage();
  return storage.account;
}

/**
 * Save account info
 */
async function saveAccount(account) {
  await setStorage({
    account: {
      ...account,
      createdAt: new Date().toISOString()
    }
  });
}

/**
 * Get item count
 */
async function getItemCount() {
  const storage = await getStorage();
  return storage.itemCount || 0;
}

/**
 * Check if account prompt should be shown (after 10 items)
 */
async function shouldShowAccountPrompt() {
  const storage = await getStorage();
  return storage.itemCount >= 10 && !storage.account;
}

/**
 * Export giftist data for sharing
 */
async function exportGiftlist() {
  const storage = await getStorage();
  return {
    items: storage.giftist || [],
    categories: storage.categories || DEFAULT_CATEGORIES,
    shareId: storage.shareId,
    exportedAt: new Date().toISOString()
  };
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.GiftistStorage = {
    generateId,
    getStorage,
    setStorage,
    getItems,
    addItem,
    updateItem,
    deleteItem,
    updateItemPrice,
    updateItemBackendId,
    updateItemFromBackend,
    mergeBackendItems,
    getItemsWithPriceDrops,
    getCategories,
    addCategory,
    deleteCategory,
    getShareId,
    getAccount,
    saveAccount,
    getItemCount,
    shouldShowAccountPrompt,
    exportGiftlist
  };
}
