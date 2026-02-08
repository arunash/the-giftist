/**
 * Content script for The Giftist
 * Extracts product information from web pages
 */

(function() {
  'use strict';

  /**
   * Extract product info using JSON-LD structured data
   */
  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const product = findProductInJsonLd(data);
        if (product) return product;
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    return null;
  }

  /**
   * Recursively find Product schema in JSON-LD data
   */
  function findProductInJsonLd(data) {
    if (!data) return null;

    // Handle array of schemas
    if (Array.isArray(data)) {
      for (const item of data) {
        const result = findProductInJsonLd(item);
        if (result) return result;
      }
      return null;
    }

    // Check if this is a Product
    if (data['@type'] === 'Product' || data['@type']?.includes?.('Product')) {
      return {
        name: data.name,
        price: extractPriceFromSchema(data),
        priceValue: extractPriceValueFromSchema(data),
        image: extractImageFromSchema(data)
      };
    }

    // Check @graph array
    if (data['@graph']) {
      return findProductInJsonLd(data['@graph']);
    }

    return null;
  }

  /**
   * Extract price string from schema
   */
  function extractPriceFromSchema(data) {
    const offers = data.offers;
    if (!offers) return null;

    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (!offer) return null;

    const price = offer.price || offer.lowPrice;
    const currency = offer.priceCurrency || 'USD';

    if (price) {
      return formatPrice(price, currency);
    }

    return null;
  }

  /**
   * Extract numeric price value from schema
   */
  function extractPriceValueFromSchema(data) {
    const offers = data.offers;
    if (!offers) return null;

    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (!offer) return null;

    const price = offer.price || offer.lowPrice;
    return price ? parseFloat(price) : null;
  }

  /**
   * Extract image from schema
   */
  function extractImageFromSchema(data) {
    const image = data.image;
    if (!image) return null;

    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return image[0];
    if (image.url) return image.url;
    if (image['@id']) return image['@id'];

    return null;
  }

  /**
   * Format price with currency symbol
   */
  function formatPrice(price, currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'INR': '₹',
      'CAD': 'CA$',
      'AUD': 'A$'
    };

    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${parseFloat(price).toFixed(2)}`;
  }

  /**
   * Extract product info from Open Graph meta tags
   */
  function extractFromOpenGraph() {
    const getMeta = (property) => {
      const meta = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
      return meta?.content || null;
    };

    const title = getMeta('og:title') || getMeta('twitter:title');
    const image = getMeta('og:image') || getMeta('twitter:image');
    const priceAmount = getMeta('product:price:amount') || getMeta('og:price:amount');
    const priceCurrency = getMeta('product:price:currency') || getMeta('og:price:currency') || 'USD';

    if (title || image) {
      return {
        name: title,
        price: priceAmount ? formatPrice(priceAmount, priceCurrency) : null,
        priceValue: priceAmount ? parseFloat(priceAmount) : null,
        image: image
      };
    }

    return null;
  }

  /**
   * Extract product info from common e-commerce DOM patterns
   */
  function extractFromDOM() {
    // Common selectors for product pages
    const nameSelectors = [
      // Amazon
      '#productTitle',
      '#title',
      // General e-commerce
      'h1[itemprop="name"]',
      '[data-testid="product-title"]',
      '.product-title',
      '.product-name',
      '.pdp-title',
      // Shopify
      '.product__title',
      '.product-single__title',
      // WooCommerce
      '.product_title',
      // eBay
      '.x-item-title__mainTitle',
      // Target
      '[data-test="product-title"]',
      // Walmart
      '[itemprop="name"]',
      // Generic fallback
      'h1'
    ];

    const priceSelectors = [
      // Amazon
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      // General
      '[itemprop="price"]',
      '[data-testid="product-price"]',
      '.product-price',
      '.price',
      '.pdp-price',
      // Shopify
      '.product__price',
      '.price__current',
      // WooCommerce
      '.woocommerce-Price-amount',
      // eBay
      '.x-price-primary',
      // Target
      '[data-test="product-price"]',
      // Walmart
      '[itemprop="price"]',
      '.price-characteristic'
    ];

    const imageSelectors = [
      // Amazon
      '#landingImage',
      '#imgBlkFront',
      // General
      '[itemprop="image"]',
      '.product-image img',
      '.product-gallery img',
      '.pdp-image img',
      // Shopify
      '.product__media img',
      '.product-single__photo img',
      // WooCommerce
      '.woocommerce-product-gallery img',
      // eBay
      '.ux-image-carousel img',
      // Target/Walmart
      '[data-test="product-image"] img',
      // Generic - find largest image
      'img[src*="product"]',
      'main img'
    ];

    const name = findFirstMatch(nameSelectors, 'text');
    const priceText = findFirstMatch(priceSelectors, 'text');
    const image = findFirstMatch(imageSelectors, 'src');

    const priceValue = priceText ? extractPriceValue(priceText) : null;

    return {
      name: name ? cleanText(name) : null,
      price: priceText ? cleanPrice(priceText) : null,
      priceValue: priceValue,
      image: image
    };
  }

  /**
   * Find first matching element
   */
  function findFirstMatch(selectors, attr) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          if (attr === 'text') {
            const text = element.textContent?.trim();
            if (text) return text;
          } else if (attr === 'src') {
            const src = element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src');
            if (src) return src;
          } else {
            const value = element.getAttribute(attr);
            if (value) return value;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  /**
   * Clean text content
   */
  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Clean and format price text
   */
  function cleanPrice(text) {
    // Extract price pattern
    const priceMatch = text.match(/[$£€¥₹]?\s*[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0].trim() : text.trim().substring(0, 20);
  }

  /**
   * Extract numeric price value
   */
  function extractPriceValue(text) {
    const numbers = text.replace(/[^0-9.]/g, '');
    const value = parseFloat(numbers);
    return isNaN(value) ? null : value;
  }

  /**
   * Find the largest image on the page (fallback)
   */
  function findLargestImage() {
    const images = Array.from(document.querySelectorAll('img'));
    let largest = null;
    let maxArea = 0;

    for (const img of images) {
      // Skip tiny images (icons, spacers)
      if (img.naturalWidth < 100 || img.naturalHeight < 100) continue;
      // Skip base64 images
      if (img.src?.startsWith('data:')) continue;

      const area = img.naturalWidth * img.naturalHeight;
      if (area > maxArea) {
        maxArea = area;
        largest = img.src;
      }
    }

    return largest;
  }

  /**
   * Main extraction function - tries multiple strategies
   */
  function extractProductInfo() {
    // Try JSON-LD first (most reliable)
    const jsonLd = extractFromJsonLd();

    // Try Open Graph
    const og = extractFromOpenGraph();

    // Try DOM extraction
    const dom = extractFromDOM();

    // Merge results, preferring more reliable sources
    const result = {
      name: jsonLd?.name || og?.name || dom?.name || document.title,
      price: jsonLd?.price || og?.price || dom?.price || null,
      priceValue: jsonLd?.priceValue || og?.priceValue || dom?.priceValue || null,
      image: jsonLd?.image || og?.image || dom?.image || findLargestImage(),
      url: window.location.href,
      domain: window.location.hostname
    };

    // Clean up the name if it's the page title with site name
    if (result.name.includes(' | ') || result.name.includes(' - ')) {
      result.name = result.name.split(/\s*[|\-–—]\s*/)[0].trim();
    }

    return result;
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProductInfo') {
      const productInfo = extractProductInfo();
      sendResponse(productInfo);
    }
    return true; // Keep message channel open for async response
  });

  // Auto-detect product on page load and cache
  let cachedProductInfo = null;

  function cacheProductInfo() {
    cachedProductInfo = extractProductInfo();
  }

  // Cache after page fully loads
  if (document.readyState === 'complete') {
    cacheProductInfo();
  } else {
    window.addEventListener('load', cacheProductInfo);
  }

})();
