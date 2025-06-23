// src/main.ts
import './style.css'
import { supabase } from './supabaseClient';
import { auth } from './auth'; // Import our new auth store
import { renderNavbar } from './components/navbar';
import { renderLandingPage } from './pages/landing';
import { renderAboutPage } from './pages/about';
import { renderLoginPage } from './pages/login';
import { renderAppPage } from './pages/app';

const appContainer = document.getElementById('app') as HTMLElement;
const navbarContainer = document.getElementById('navbar-container') as HTMLElement;

const routes: { [key: string]: (container: HTMLElement) => void } = {
  '/': renderLandingPage,
  '/about': renderAboutPage,
  '/login': renderLoginPage,
  '/app': renderAppPage,
};

const router = () => {
  const path = window.location.pathname;
  // NO MORE ROUTE GUARDING! We will let the app page handle it.
  const renderPage = routes[path] || routes['/'];
  renderPage(appContainer);
};

// AUTH STATE LISTENER
supabase.auth.onAuthStateChange((event, session) => {
    // Update our shared state whenever auth changes
    auth.setSession(session);
    // Re-render the navbar to show the correct state (Sign In vs. Sign Out)
    renderNavbar(navbarContainer);

    if (event === 'SIGNED_IN') {
        history.pushState(null, '', '/app');
        router();
    }
    if (event === 'SIGNED_OUT') {
        history.pushState(null, '', '/');
        router();
    }
});

// INITIAL LOAD
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for the initial session to be set before rendering the navbar
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  renderNavbar(navbarContainer);

  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.href);
      router();
    }
  });
  
  router();
});