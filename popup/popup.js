/**
 * The Giftist - Popup Script
 */

(function() {
  'use strict';

  // DOM Elements
  const elements = {
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Current product
    currentProduct: document.getElementById('currentProduct'),
    noProduct: document.getElementById('noProduct'),
    previewImage: document.getElementById('previewImage'),
    previewName: document.getElementById('previewName'),
    previewPrice: document.getElementById('previewPrice'),
    categorySelect: document.getElementById('categorySelect'),
    addButton: document.getElementById('addButton'),

    // Items
    itemsGrid: document.getElementById('itemsGrid'),
    itemCount: document.getElementById('itemCount'),
    emptyState: document.getElementById('emptyState'),
    priceDropBadge: document.getElementById('priceDropBadge'),

    // Categories
    categoriesList: document.getElementById('categoriesList'),
    newCategory: document.getElementById('newCategory'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),

    // Share
    shareLink: document.getElementById('shareLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareHint: document.getElementById('shareHint'),

    // Modal & Toast
    accountModal: document.getElementById('accountModal'),
    skipAuthBtn: document.getElementById('skipAuthBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
  };

  // Current page product data
  let currentProductData = null;

  /**
   * Initialize the popup
   */
  async function init() {
    setupTabs();
    await loadCurrentProduct();
    await loadCategories();
    await loadItems();
    await loadShareLink();
    await checkPriceDrops();
    setupEventListeners();
  }

  /**
   * Setup tab navigation
   */
  function setupTabs() {
    elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;

        // Update active tab
        elements.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show active content
        elements.tabContents.forEach(content => {
          content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
      });
    });
  }

  /**
   * Load current product from active tab
   */
  async function loadCurrentProduct() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        showNoProduct();
        return;
      }

      // Request product info from content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProductInfo' });

      if (response && response.name) {
        currentProductData = response;
        displayCurrentProduct(response);
      } else {
        showNoProduct();
      }
    } catch (error) {
      console.error('Error loading product:', error);
      showNoProduct();
    }
  }

  /**
   * Display current product preview
   */
  function displayCurrentProduct(product) {
    elements.currentProduct.hidden = false;
    elements.noProduct.hidden = true;

    elements.previewImage.src = product.image || '../icons/icon128.png';
    elements.previewImage.alt = product.name;
    elements.previewName.textContent = product.name;
    elements.previewPrice.textContent = product.price || '';
  }

  /**
   * Show no product state
   */
  function showNoProduct() {
    elements.currentProduct.hidden = true;
    elements.noProduct.hidden = false;
  }

  /**
   * Load categories into dropdown and list
   */
  async function loadCategories() {
    const categories = await GiftistStorage.getCategories();

    // Update dropdown
    elements.categorySelect.innerHTML = '<option value="">No category</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      elements.categorySelect.appendChild(option);
    });

    // Update categories list
    await renderCategoriesList(categories);
  }

  /**
   * Render categories management list
   */
  async function renderCategoriesList(categories) {
    const items = await GiftistStorage.getItems();

    elements.categoriesList.innerHTML = categories.map(cat => {
      const count = items.filter(item => item.category === cat).length;
      return `
        <li class="category-item">
          <span>
            <span class="category-name">${escapeHtml(cat)}</span>
            <span class="category-count">(${count})</span>
          </span>
          <button class="category-delete" data-category="${escapeHtml(cat)}" title="Delete category">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </li>
      `;
    }).join('');

    // Add delete handlers
    elements.categoriesList.querySelectorAll('.category-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const category = btn.dataset.category;
        await GiftistStorage.deleteCategory(category);
        await loadCategories();
        await loadItems();
        showToast(`Deleted "${category}" category`);
      });
    });
  }

  /**
   * Load and display saved items
   */
  async function loadItems() {
    const items = await GiftistStorage.getItems();

    elements.itemCount.textContent = `(${items.length})`;

    if (items.length === 0) {
      elements.itemsGrid.innerHTML = '';
      elements.emptyState.hidden = false;
      return;
    }

    elements.emptyState.hidden = true;
    elements.itemsGrid.innerHTML = items.map(item => renderItemCard(item)).join('');

    // Add event listeners to cards
    elements.itemsGrid.querySelectorAll('.item-card').forEach(card => {
      const id = card.dataset.id;

      // Open product page
      card.querySelector('.item-image')?.addEventListener('click', () => {
        const item = items.find(i => i.id === id);
        if (item) chrome.tabs.create({ url: item.url });
      });

      card.querySelector('.item-btn-open')?.addEventListener('click', () => {
        const item = items.find(i => i.id === id);
        if (item) chrome.tabs.create({ url: item.url });
      });

      // Delete item
      card.querySelector('.item-btn-delete')?.addEventListener('click', async () => {
        await GiftistStorage.deleteItem(id);
        await loadItems();
        showToast('Item removed');
      });
    });
  }

  /**
   * Render a single item card
   */
  function renderItemCard(item) {
    const hasPriceDrop = checkItemPriceDrop(item);
    const originalPrice = item.priceHistory?.[0]?.price;

    return `
      <div class="item-card ${hasPriceDrop ? 'price-drop' : ''}" data-id="${item.id}">
        <img class="item-image" src="${item.image || '../icons/icon128.png'}" alt="${escapeHtml(item.name)}" loading="lazy">
        <div class="item-info">
          <h3 class="item-name">${escapeHtml(item.name)}</h3>
          ${item.price ? `
            <p class="item-price ${hasPriceDrop ? 'dropped' : ''}">${item.price}</p>
            ${hasPriceDrop && originalPrice ? `<p class="item-original-price">$${originalPrice.toFixed(2)}</p>` : ''}
          ` : ''}
          ${item.category ? `<span class="item-category">${escapeHtml(item.category)}</span>` : ''}
        </div>
        <div class="item-actions">
          <button class="item-btn item-btn-open">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open
          </button>
          <button class="item-btn item-btn-delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Check if item has a price drop
   */
  function checkItemPriceDrop(item) {
    if (!item.priceHistory || item.priceHistory.length < 2) return false;
    const currentPrice = item.priceValue;
    const originalPrice = item.priceHistory[0].price;
    return currentPrice < originalPrice;
  }

  /**
   * Check for price drops and update badge
   */
  async function checkPriceDrops() {
    const droppedItems = await GiftistStorage.getItemsWithPriceDrops();

    if (droppedItems.length > 0) {
      elements.priceDropBadge.hidden = false;
      elements.priceDropBadge.querySelector('.badge-count').textContent = droppedItems.length;
    } else {
      elements.priceDropBadge.hidden = true;
    }
  }

  /**
   * Load share link
   */
  async function loadShareLink() {
    const shareId = await GiftistStorage.getShareId();
    const shareUrl = `https://mygiftlist.app/share/${shareId}`;
    elements.shareLink.value = shareUrl;
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Add button
    elements.addButton.addEventListener('click', handleAddProduct);

    // Add category
    elements.addCategoryBtn.addEventListener('click', handleAddCategory);
    elements.newCategory.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddCategory();
    });

    // Copy share link
    elements.copyLinkBtn.addEventListener('click', handleCopyLink);

    // Skip auth
    elements.skipAuthBtn.addEventListener('click', () => {
      elements.accountModal.hidden = true;
    });
  }

  /**
   * Handle adding current product
   */
  async function handleAddProduct() {
    if (!currentProductData) {
      showToast('No product detected on this page', 'error');
      return;
    }

    const category = elements.categorySelect.value || null;

    const { item, itemCount } = await GiftistStorage.addItem({
      ...currentProductData,
      category
    });

    showToast('Added to your Giftist!', 'success');
    await loadItems();

    // Check if we should show account modal
    if (itemCount === 10) {
      const account = await GiftistStorage.getAccount();
      if (!account) {
        setTimeout(() => {
          elements.accountModal.hidden = false;
        }, 500);
      }
    }
  }

  /**
   * Handle adding new category
   */
  async function handleAddCategory() {
    const name = elements.newCategory.value.trim();

    if (!name) {
      showToast('Please enter a category name', 'error');
      return;
    }

    await GiftistStorage.addCategory(name);
    elements.newCategory.value = '';
    await loadCategories();
    showToast(`Added "${name}" category`, 'success');
  }

  /**
   * Handle copying share link
   */
  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(elements.shareLink.value);
      elements.shareHint.textContent = 'Link copied to clipboard!';
      showToast('Link copied!', 'success');

      setTimeout(() => {
        elements.shareHint.textContent = '';
      }, 3000);
    } catch (error) {
      showToast('Failed to copy link', 'error');
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = '') {
    elements.toast.className = `toast ${type}`;
    elements.toastMessage.textContent = message;
    elements.toast.hidden = false;

    setTimeout(() => {
      elements.toast.hidden = true;
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

})();
