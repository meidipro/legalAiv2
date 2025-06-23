// src/pages/login.ts
import { supabase } from '../supabaseClient';

const loginHTML = `
  <div class="page-container">
    <div class="login-form">
      <h1>Sign In to LegalAI</h1>
      <p>Access your saved chat history and full features.</p>
      <button type="button" class="google-signin">Sign In with Google</button>
      <div class="login-divider">or</div>
      <button type="submit" disabled style="opacity: 0.5; cursor: not-allowed;">Sign In with Email (Coming Soon)</button>
    </div>
  </div>
`;

async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin, // Redirect back to the app after login
        },
    });
    if (error) {
        alert('Error logging in: ' + error.message);
    }
}

export function renderLoginPage(container: HTMLElement) {
    container.innerHTML = loginHTML;
    const googleButton = container.querySelector('.google-signin');
    googleButton?.addEventListener('click', handleGoogleLogin);
}