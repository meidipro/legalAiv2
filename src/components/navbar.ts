// src/components/navbar.ts
import { supabase } from '../supabaseClient';
import { auth } from '../auth';

async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
    }
    // The onAuthStateChange listener in main.ts will handle the redirect to '/'.
}

export function renderNavbar(container: HTMLElement) {
    // We use the shared auth state now, which is faster and synchronous
    const session = auth.getSession();

    let navHTML = '';

    if (session) {
        // --- LOGGED-IN USER VIEW ---
        navHTML = `
          <nav class="navbar">
            <a href="/app" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            <div class="nav-links">
              <a href="/app" class="nav-link" data-link>My Chats</a>
              <a href="/about" class="nav-link" data-link>About</a>
            </div>
            <div class="nav-buttons">
              <a href="/profile" class="nav-link" data-link>Profile</a>
              <button id="sign-out-btn" class="nav-button nav-button-primary">Sign Out</button>
            </div>
          </nav>
        `;
    } else {
        // --- LOGGED-OUT GUEST VIEW ---
        navHTML = `
          <nav class="navbar">
            <a href="/" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            <div class="nav-links">
              <a href="/#features" class="nav-link" data-link>Features</a>
              <a href="/about" class="nav-link" data-link>About</a>
              <a href="mailto:contact@legalai.bd" class="nav-link">Contact</a>
            </div>
            <div class="nav-buttons">
              <a href="/login" class="nav-link" data-link>Sign In</a>
              <a href="/login" class="nav-button nav-button-primary" data-link>Sign Up Free</a>
            </div>
          </nav>
        `;
    }

    container.innerHTML = navHTML;

    // Add event listener only if the sign out button exists
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }
}