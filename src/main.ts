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

// --- A SIMPLIFIED AND MORE RELIABLE ROUTER ---
const router = () => {
    const session = auth.getSession();
    let path = window.location.pathname;

    // Normalize root path
    if (path === "" || path === "/index.html") {
        path = "/";
    }

    // This is the ONLY protection rule the router needs.
    // It prevents guests from accessing pages that have NO guest state.
    const protectedRoutes = ['/profile'];
    if (!session && protectedRoutes.includes(path)) {
        history.pushState(null, '', '/login');
        path = '/login';
    }

    // Render the page for the determined path.
    const renderPage = routes[path] || routes['/'];
    renderPage(appContainer);
};

// --- A SMARTER AUTH STATE LISTENER ---
supabase.auth.onAuthStateChange((_event, session) => {
    auth.setSession(session);
    renderNavbar(navbarContainer);

    const currentPath = window.location.pathname;

    // This block handles the LOGOUT event.
    if (!session) {
        // If the user was on a page that requires login, redirect them to the homepage.
        if (currentPath === '/app' || currentPath === '/profile') {
            history.pushState(null, '', '/');
            router(); // Render the homepage
        } else {
            // Otherwise, just re-render the current public page (e.g., /about)
            router();
        }
    } 
    // This block handles the LOGIN event.
    else {
        // The redirectTo in login.ts handles the main OAuth flow.
        // This is a fallback for other cases, ensuring if a user logs in
        // while on the login page, they are sent to the app.
        if (currentPath === '/login') {
            history.pushState(null, '', '/app');
            router();
        } else {
            // Re-render the current page with the new session data.
            router();
        }
    }
});

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  
  renderNavbar(navbarContainer);
  router();

  // Standard SPA navigation for internal links
  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.href);
      router();
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', router);
  
  // Handle language changes
  window.addEventListener('languageChange', () => {
    renderNavbar(navbarContainer);
    router();
  });
});