/**
 * The Giftist - Authentication Module
 * Handles authentication via the portal (giftist.ai)
 */

(function() {
  'use strict';

  let authCheckInterval = null;

  /**
   * Initialize auth event listeners
   */
  function initAuth() {
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const skipAuthBtn = document.getElementById('skipAuthBtn');

    // Both buttons open the portal login page
    googleAuthBtn?.addEventListener('click', handlePortalLogin);
    sendCodeBtn?.addEventListener('click', handlePortalLogin);

    // Skip auth
    skipAuthBtn?.addEventListener('click', () => {
      closeAuthModal();
    });

    // Check auth status on load
    updateAuthStatus();
  }

  /**
   * Open portal login page and poll for session cookie
   */
  async function handlePortalLogin() {
    GiftistAPI.openLoginPage();

    showAuthToast('Sign in on the portal tab, then come back here', 'success');

    // Poll for auth completion every 2 seconds for up to 5 minutes
    let attempts = 0;
    if (authCheckInterval) clearInterval(authCheckInterval);

    authCheckInterval = setInterval(async () => {
      attempts++;
      const session = await GiftistAPI.checkAuth();

      if (session) {
        clearInterval(authCheckInterval);
        authCheckInterval = null;

        await GiftistStorage.saveAccount({
          phone: session.user.phone || null,
          googleId: session.user.email || null,
          name: session.user.name || null,
          verified: true,
        });

        closeAuthModal();
        updateAuthStatus();

        // Bulk sync existing local items to backend
        showAuthToast('Syncing your items to the portal...', 'success');
        try {
          const result = await GiftistAPI.syncAllItems();
          if (result.synced > 0) {
            showAuthToast(`Synced ${result.synced} item${result.synced !== 1 ? 's' : ''} to portal!`, 'success');
          } else {
            showAuthToast('Signed in! Items will sync automatically.', 'success');
          }
        } catch (e) {
          showAuthToast('Signed in! Some items failed to sync.', 'error');
        }
      }

      if (attempts >= 150) {
        clearInterval(authCheckInterval);
        authCheckInterval = null;
      }
    }, 2000);
  }

  /**
   * Update UI based on auth status, and sync any unsynced items
   */
  async function updateAuthStatus() {
    const session = await GiftistAPI.checkAuth();

    // If authenticated, quietly sync any items not yet on the backend
    if (session) {
      GiftistAPI.syncAllItems().catch(() => {});
    }
    const headerEl = document.querySelector('.header');

    // Remove existing status indicator
    const existing = document.getElementById('syncStatus');
    if (existing) existing.remove();

    const statusEl = document.createElement('div');
    statusEl.id = 'syncStatus';
    statusEl.style.cssText = 'font-size: 11px; display: flex; align-items: center; gap: 4px;';

    if (session) {
      statusEl.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#00B894;display:inline-block;"></span> <span style="color:#666;">${session.user.name || 'Synced'}</span>`;
    } else {
      statusEl.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#ccc;display:inline-block;"></span> <a href="#" id="loginLink" style="color:#E17055;font-size:11px;">Sign in to sync</a>`;
      statusEl.querySelector('#loginLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        handlePortalLogin();
      });
    }

    headerEl?.appendChild(statusEl);
  }

  /**
   * Show toast notification in auth context
   */
  function showAuthToast(message, type) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    if (toast && toastMessage) {
      toast.className = `toast ${type}`;
      toastMessage.textContent = message;
      toast.hidden = false;

      setTimeout(() => {
        toast.hidden = true;
      }, 3000);
    }
  }

  /**
   * Close auth modal
   */
  function closeAuthModal() {
    const modal = document.getElementById('accountModal');
    if (modal) {
      modal.hidden = true;
    }
  }

  /**
   * Check if user should see account prompt
   */
  async function checkAccountPrompt() {
    const session = await GiftistAPI.checkAuth();
    if (session) return; // Already logged in

    const shouldShow = await GiftistStorage.shouldShowAccountPrompt();
    if (shouldShow) {
      const modal = document.getElementById('accountModal');
      if (modal) {
        modal.hidden = false;
      }
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initAuth);

  // Expose for use in popup.js
  window.GiftistAuth = {
    initAuth,
    handlePortalLogin,
    checkAccountPrompt,
    updateAuthStatus,
  };

})();
