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

const router = async () => {
  let path = window.location.pathname;
  if (path === "" || path === "/index.html") path = "/";

  const session = auth.getSession();
  const protectedRoutes = ['/profile']; 
  
  if (!session && protectedRoutes.includes(path)) {
      history.pushState(null, '', '/login');
      path = '/login';
  }

  const renderPage = routes[path] || routes['/'];
  renderPage(appContainer);
};

supabase.auth.onAuthStateChange((_event, session) => {
    auth.setSession(session);
    renderNavbar(navbarContainer);
    router();
});

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  auth.setSession(session);
  
  renderNavbar(navbarContainer);
  router();

  document.body.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]') as HTMLAnchorElement;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.href);
      router();
    }
  });

  window.addEventListener('popstate', router);

  // Add a global listener for our custom languageChange event.
  // When the language is changed anywhere in the app, this will fire.
  window.addEventListener('languageChange', () => {
    // Re-render the navbar and the current page to reflect the new language
    renderNavbar(navbarContainer);
    router();
  });
});