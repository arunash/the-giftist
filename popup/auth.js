/**
 * The Giftist - Authentication Module
 * Handles Google and Phone authentication
 */

(function() {
  'use strict';

  // Auth state
  let verificationId = null;

  /**
   * Initialize auth event listeners
   */
  function initAuth() {
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const phoneInput = document.getElementById('phoneInput');
    const codeInput = document.getElementById('codeInput');
    const verifyCodeSection = document.getElementById('verifyCode');

    // Google Sign-In
    googleAuthBtn?.addEventListener('click', handleGoogleAuth);

    // Phone Auth - Send Code
    sendCodeBtn?.addEventListener('click', async () => {
      const phone = phoneInput?.value?.trim();

      if (!isValidPhone(phone)) {
        showAuthToast('Please enter a valid phone number', 'error');
        return;
      }

      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = 'Sending...';

      try {
        // In production, this would call your backend to send SMS
        // For now, we simulate the flow
        verificationId = await sendVerificationCode(phone);

        verifyCodeSection.hidden = false;
        sendCodeBtn.textContent = 'Code Sent!';
        showAuthToast('Verification code sent!', 'success');
      } catch (error) {
        showAuthToast('Failed to send code. Try again.', 'error');
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Send Code';
      }
    });

    // Phone Auth - Verify Code
    verifyCodeBtn?.addEventListener('click', async () => {
      const code = codeInput?.value?.trim();

      if (!code || code.length !== 6) {
        showAuthToast('Please enter the 6-digit code', 'error');
        return;
      }

      verifyCodeBtn.disabled = true;
      verifyCodeBtn.textContent = 'Verifying...';

      try {
        const phone = phoneInput?.value?.trim();
        const verified = await verifyCode(verificationId, code);

        if (verified) {
          await GiftistStorage.saveAccount({
            phone: phone,
            googleId: null,
            verified: true
          });

          showAuthToast('Account created successfully!', 'success');
          closeAuthModal();
        } else {
          showAuthToast('Invalid code. Please try again.', 'error');
          verifyCodeBtn.disabled = false;
          verifyCodeBtn.textContent = 'Verify';
        }
      } catch (error) {
        showAuthToast('Verification failed. Try again.', 'error');
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.textContent = 'Verify';
      }
    });
  }

  /**
   * Handle Google authentication using Chrome Identity API
   */
  async function handleGoogleAuth() {
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    googleAuthBtn.disabled = true;

    try {
      // Use Chrome Identity API for Google Sign-In
      // Note: This requires oauth2 configuration in manifest.json for production
      const token = await new Promise((resolve, reject) => {
        // Check if chrome.identity is available
        if (chrome.identity && chrome.identity.getAuthToken) {
          chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(token);
            }
          });
        } else {
          // Fallback: Simulate Google auth for development
          // In production, you'd use the actual Identity API
          setTimeout(() => {
            resolve('simulated-token-' + Date.now());
          }, 1000);
        }
      });

      if (token) {
        // Get user info from token (in production)
        // For now, create account with simulated data
        await GiftistStorage.saveAccount({
          phone: null,
          googleId: 'google-user-' + Date.now(),
          verified: true
        });

        showAuthToast('Signed in with Google!', 'success');
        closeAuthModal();
      }
    } catch (error) {
      console.error('Google auth error:', error);
      showAuthToast('Google sign-in failed. Try phone instead.', 'error');
      googleAuthBtn.disabled = false;
    }
  }

  /**
   * Send verification code to phone number
   * In production, this calls your backend which uses Twilio/similar
   */
  async function sendVerificationCode(phone) {
    // Simulate API call to send SMS
    // In production: POST to your backend
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return a mock verification ID
        resolve('verify-' + Date.now());
      }, 1500);
    });
  }

  /**
   * Verify the code entered by user
   * In production, this verifies with your backend
   */
  async function verifyCode(verificationId, code) {
    // Simulate verification
    // In production: POST to your backend to verify
    return new Promise((resolve) => {
      setTimeout(() => {
        // Accept any 6-digit code for demo purposes
        // In production, validate against stored code
        resolve(code.length === 6);
      }, 1000);
    });
  }

  /**
   * Validate phone number format
   */
  function isValidPhone(phone) {
    if (!phone) return false;
    // Basic validation - accepts various formats
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?[0-9]{10,15}$/.test(cleaned);
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
    handleGoogleAuth,
    checkAccountPrompt
  };

})();
