// src/pages/about.ts

const aboutHTML = `
  <div class="page-container">
    <h1>About LegalAI.bd</h1>
    <p>Our mission is to make the laws and legal system of Bangladesh accessible to everyone. We aim to empower citizens, assist students, and enhance the productivity of legal professionals through the power of artificial intelligence.</p>
    <p>This project is a demonstration of how modern technology can be used to bridge the gap between complex legal texts and the people they are meant to serve.</p>
  </div>
`;

export function renderAboutPage(container: HTMLElement) {
    container.innerHTML = aboutHTML;
}