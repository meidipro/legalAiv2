// src/main.ts
import './style.css'
import { supabase } from './supabaseClient';
import { auth } from './auth';
import { renderNavbar } from './components/navbar';
import { renderLandingPage } from './pages/landing';
import { renderAboutPage } from './pages/about';
import { renderLoginPage } from './pages/login';
import { renderAppPage } from './pages/app';
import { renderUserProfilePage } from './pages/user-profile'; // <-- IMPORT THE NEW PAGE

const appContainer = document.getElementById('app') as HTMLElement;
const navbarContainer = document.getElementById('navbar-container') as HTMLElement;

// Add the new route
const routes: { [key: string]: (container: HTMLElement) => void } = {
  '/': renderLandingPage,
  '/about': renderAboutPage,
  '/login': renderLoginPage,
  '/app': renderAppPage,
  '/profile': renderUserProfilePage, // <-- ADD THE PROFILE ROUTE
};

const router = async () => {
  let path = window.location.pathname;
  if (path === "") path = "/";

  // --- ROUTE GUARDING for protected pages ---
  const session = auth.getSession();
  const protectedRoutes = ['/app', '/profile'];
  
  if (!session && protectedRoutes.includes(path)) {
      history.pushState(null, '', '/login');
      path = '/login';
  }

  const renderPage = routes[path] || routes['/']; // Default to landing page
  renderPage(appContainer);
};

// AUTH STATE LISTENER
supabase.auth.onAuthStateChange((_event, session) => {
    auth.setSession(session);
    renderNavbar(navbarContainer);
    // After login/logout, re-route to ensure correct page is shown
    router();
});

// INITIAL LOAD
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for the initial session to be set from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  
  // Now render the navbar and the initial page
  renderNavbar(navbarContainer);
  router();

  // Handle navigation
  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.href);
      router();
    }
  });

  // Handle back/forward browser buttons
  window.addEventListener('popstate', router);
});