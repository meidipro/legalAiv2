// src/pages/landing.ts

const landingHTML = `
  <div class="page-container">
    <h1>Your Trusted AI Legal Assistant for Bangladesh</h1>
    <p>Simplify legal information, support your studies, and boost your productivity. Get clear, understandable answers without the jargon.</p>
    <div class="cta-buttons">
      <a href="/app" class="cta-button primary" data-link>Try LegalAI Now</a>
      <a href="/login" class="cta-button secondary" data-link>Sign In for Full Features</a>
    </div>
  </div>
`;

export function renderLandingPage(container: HTMLElement) {
    container.innerHTML = landingHTML;
}