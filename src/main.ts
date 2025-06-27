// src/main.ts
import './style.css'
import { supabase } from './supabaseClient';
import { auth } from './auth';
import { renderNavbar } from './components/navbar';
import { renderLandingPage } from './pages/landing';
import { renderAboutPage } from './pages/about';
import { renderLoginPage } from './pages/login';
import { renderAppPage } from './pages/app';
import { renderUserProfilePage } from './pages/user-profile';

const appContainer = document.getElementById('app') as HTMLElement;
const navbarContainer = document.getElementById('navbar-container') as HTMLElement;

const routes: { [key: string]: (container: HTMLElement) => void } = {
  '/': renderLandingPage,
  '/about': renderAboutPage,
  '/login': renderLoginPage,
  '/app': renderAppPage,
  '/profile': renderUserProfilePage,
};

// --- NEW: A dedicated function to handle routing and redirects ---
const navigate = () => {
    const session = auth.getSession();
    let path = window.location.pathname;

    // Normalize root path
    if (path === "" || path === "/index.html") {
        path = "/";
    }

    const isAuthPage = (path === '/login');
    const isProtectedPage = (path === '/app' || path === '/profile');

    // Rule 1: If user is logged in and on the login page, redirect to the app.
    if (session && isAuthPage) {
        history.pushState(null, '', '/app');
        renderAppPage(appContainer);
        return; // Stop further execution
    }

    // Rule 2: If user is NOT logged in and tries to access a protected page, redirect to login.
    if (!session && isProtectedPage) {
        history.pushState(null, '', '/login');
        renderLoginPage(appContainer);
        return; // Stop further execution
    }

    // Rule 3 (Optional but recommended): If a logged-in user lands on the homepage, send them to the app.
    if (session && path === '/') {
        history.pushState(null, '', '/app');
        renderAppPage(appContainer);
        return; // Stop further execution
    }

    // If no redirect rules apply, render the page for the current path.
    const renderPage = routes[path] || routes['/'];
    renderPage(appContainer);
};

// --- Refactored Auth State Listener ---
supabase.auth.onAuthStateChange((_event, session) => {
    console.log("Auth state changed, new session:", session);
    auth.setSession(session);
    renderNavbar(navbarContainer);
    // Call our new, robust navigation function
    navigate();
});

// --- Refactored Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  
  renderNavbar(navbarContainer);
  // Call our new, robust navigation function
  navigate();

  // Handle client-side navigation (when a user clicks a link)
  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.href);
      // Call our new, robust navigation function
      navigate();
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', navigate);
  
  // Handle language changes
  window.addEventListener('languageChange', () => {
    renderNavbar(navbarContainer);
    // Call our new, robust navigation function
    navigate();
  });
});