// src/pages/user-profile.ts
import { auth } from '../auth';
import { supabase } from '../supabaseClient';

// Note: This is a placeholder logic. A real update would require more complex form handling.
async function handleProfileUpdate(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const fullName = formData.get('fullName') as string;
    const user = auth.getSession()?.user;

    if (!user) {
        alert("You must be logged in to update your profile.");
        return;
    }

    // In a real app, you would have a 'profiles' table linked by user_id
    // For now, we'll update the user's metadata as an example.
    const { data, error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
    });

    if (error) {
        alert("Error updating profile: " + error.message);
    } else {
        alert("Profile updated successfully!");
        // We could re-render parts of the UI here if needed
        console.log("Updated user data:", data.user);
    }
}


export function renderUserProfilePage(container: HTMLElement) {
    const session = auth.getSession();

    if (!session) {
        container.innerHTML = `<div class="page-container"><p>You must be logged in to view this page.</p></div>`;
        return;
    }

    // The user's full name might be in the metadata
    const fullName = session.user.user_metadata?.full_name || '';
    
    container.innerHTML = `
      <div class="page-container">
        <form class="login-form" id="profile-form">
          <h1>Your Profile</h1>
          <p>Update your personal information below.</p>
          
          <div>
            <label for="email" style="display: block; text-align: left; margin-bottom: 4px;">Email</label>
            <input type="email" id="email" value="${session.user.email}" disabled>
          </div>
          
          <div>
            <label for="fullName" style="display: block; text-align: left; margin-bottom: 4px;">Full Name</label>
            <input type="text" id="fullName" name="fullName" value="${fullName}" placeholder="Enter your full name">
          </div>

          <button type="submit">Update Profile</button>
        </form>
      </div>
    `;

    const profileForm = document.getElementById('profile-form');
    profileForm?.addEventListener('submit', handleProfileUpdate);
}