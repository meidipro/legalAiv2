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

// Define your routes
const routes: { [key: string]: (container: HTMLElement) => void } = {
  '/': renderLandingPage,
  '/about': renderAboutPage,
  '/login': renderLoginPage,
  '/app': renderAppPage,
  '/profile': renderUserProfilePage,
};

// The router function
const router = async () => {
  let path = window.location.pathname;
  if (path === "" || path === "/index.html") path = "/";

  // --- CORRECTED ROUTE GUARDING ---
  const session = auth.getSession();
  // Only the profile page is protected. The /app page can handle guests itself.
  const protectedRoutes = ['/profile']; 
  
  if (!session && protectedRoutes.includes(path)) {
      // If a guest tries to access a protected route, send them to the login page.
      history.pushState(null, '', '/login');
      path = '/login';
  }

  const renderPage = routes[path] || routes['/']; // Default to landing page if route not found
  renderPage(appContainer);
};

// AUTH STATE LISTENER
// This automatically updates the UI when the user logs in or out
supabase.auth.onAuthStateChange((_event, session) => {
    auth.setSession(session);
    renderNavbar(navbarContainer);
    // Re-run the router to reflect the new login state
    router();
});

// INITIAL LOAD
document.addEventListener('DOMContentLoaded', async () => {
  // Check the auth state as soon as the app loads
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  
  // Render the initial navbar and page
  renderNavbar(navbarContainer);
  router();

  // Handle client-side navigation (when a user clicks a link)
  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    // Find the closest parent that is a link with the 'data-link' attribute
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault(); // Prevent the browser from doing a full page reload
      history.pushState(null, '', link.href); // Update the URL in the address bar
      router(); // Run our router to render the new page
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', router);
});