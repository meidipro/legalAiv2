// src/components/navbar.ts
import { supabase } from '../supabaseClient';

async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
    } else {
        // This will trigger the onAuthStateChange in main.ts to re-route
        window.location.hash = '/';
    }
}

export async function renderNavbar(container: HTMLElement) {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // Logged-in user view
        container.innerHTML = `
          <nav class="navbar">
            <a href="/app" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            <div class="nav-links">
              <span class="nav-link">${session.user.email}</span>
              <a href="#" id="sign-out-btn" class="nav-link">Sign Out</a>
            </div>
          </nav>
        `;
        document.getElementById('sign-out-btn')?.addEventListener('click', handleSignOut);
    } else {
        // Logged-out guest view
        container.innerHTML = `
          <nav class="navbar">
            <a href="/" class="navbar-brand" data-link>LegalAI<span>.bd</span></a>
            <div class="nav-links">
              <a href="/about" class="nav-link" data-link>About</a>
              <a href="/app" class="nav-link" data-link>Try (Guest)</a>
            </div>
            <a href="/login" class="nav-button" data-link>Sign In</a>
          </nav>
        `;
    }
}