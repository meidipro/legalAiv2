// src/pages/login.ts
import { supabase } from '../supabaseClient';

async function handleGoogleSignIn() {
    // This is the critical change.
    // We provide a `redirectTo` option which tells Supabase where to send the user
    // AFTER they have successfully authenticated with Google.
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/app`
        }
    });

    if (error) {
        console.error("Error signing in with Google:", error);
        alert("Error signing in with Google: " + error.message);
    }
}

export function renderLoginPage(container: HTMLElement) {
    // This assumes a similar structure to your other pages.
    // The key is the button with the id `google-signin-btn`.
    container.innerHTML = `
      <div class="page-container">
        <div class="login-form">
          <h1>Sign In to LegalAI</h1>
          <p>Access your saved chats and full history.</p>

          <button id="google-signin-btn" class="google-signin">
            <svg style="margin-right: 12px;" width="20" height="20" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9464 17.64 9.20455Z" fill="white"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.96182 14.4205 5.23727 13.0395 4.50545 11.1805H1.51636V13.5095C3.00545 16.2232 5.79409 18 9 18Z" fill="white"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M4.50545 11.1805C4.31636 10.6405 4.20545 10.0695 4.20545 9.47045C4.20545 8.87136 4.31636 8.29909 4.50545 7.76091V5.43182H1.51636C0.952727 6.61955 0.636364 7.97182 0.636364 9.47045C0.636364 10.9691 0.952727 12.3214 1.51636 13.5091L4.50545 11.1805Z" fill="white"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M9 4.52045C10.0214 4.52045 10.9405 4.88727 11.6836 5.59364L15.0218 2.39182C13.4632 0.902727 11.4259 0 9 0C5.79409 0 3.00545 1.77682 1.51636 4.49045L4.50545 6.81954C5.23727 4.96045 6.96182 4.52045 9 4.52045Z" fill="white"></path></svg>
            Continue with Google
          </button>

          <div class="login-divider">or sign in with email</div>

          <!-- Placeholder for email/password form -->
          <input type="email" placeholder="Email" disabled>
          <input type="password" placeholder="Password" disabled>
          <button type="submit" disabled>Sign In</button>
        </div>
      </div>
    `;

    // Attach the event listener to the button
    const googleBtn = document.getElementById('google-signin-btn');
    googleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        handleGoogleSignIn();
    });
}