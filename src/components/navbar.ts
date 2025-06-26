// src/components/navbar.ts
import { supabase } from '../supabaseClient';
import { auth } from '../auth';

async function handleSignOut() {
    await supabase.auth.signOut();
    // The onAuthStateChange listener in main.ts will handle the redirect.
}

export function renderNavbar(container: HTMLElement) {
    const session = auth.getSession();
    let navHTML = '';

    if (session) {
        // Logged-in user view
        navHTML = `
          <nav class="navbar">
            <div class="navbar-left">
              <a href="/app" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            </div>
            <div class="navbar-right">
              <div class="nav-links">
                <a href="/app" class="nav-link" data-link>My Chats</a>
                <a href="/about" class="nav-link" data-link>About</a>
              </div>
              <div class="language-switcher">
                  <span class="lang-en lang-active">EN</span> / <span class="lang-bn">বাং</span>
              </div>
              <div class="nav-buttons">
                <a href="/profile" class="nav-link" data-link>Profile</a>
                <button id="sign-out-btn" class="nav-button nav-button-primary">Sign Out</button>
              </div>
            </div>
          </nav>
        `;
    } else {
        // Logged-out guest view
        navHTML = `
          <nav class="navbar">
            <div class="navbar-left">
              <a href="/" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            </div>
            <div class="navbar-right">
              <div class="nav-links">
                <a href="/#features" class="nav-link">Features</a>
                <a href="/about" class="nav-link" data-link>About</a>
              </div>
              <div class="language-switcher">
                  <span class="lang-en lang-active">EN</span> / <span class="lang-bn">বাং</span>
              </div>
              <div class="nav-buttons">
                <a href="/login" class="nav-link" data-link>Sign In</a>
                <a href="/login" class="nav-button nav-button-primary" data-link>Sign Up Free</a>
              </div>
            </div>
          </nav>
        `;
    }
    container.innerHTML = navHTML;
    document.getElementById('sign-out-btn')?.addEventListener('click', handleSignOut);
}