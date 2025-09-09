        AOS.init();
        feather.replace();
        

  import { supabase } from './supabase-client.js';

  async function accessStudent() {
    const studentId = document.getElementById('studentId').value.trim();
    const accessCode = document.getElementById('accessCode').value.trim();
    // For security you'd persist an accessCode in a table linking parent -> student or send invitation emails.
    // Here we'll simply lookup student profile:
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('student_id', studentId).maybeSingle();
    if (error) return alert('Error: ' + error.message);
    if (!profile) return alert('Student not found');
    // now show student dashboard part and populate with profile
    document.getElementById('studentSelection').classList.add('hidden');
    document.getElementById('studentDashboard').classList.remove('hidden');

    document.querySelector('#studentDashboard h3').textContent = `${profile.first_name} ${profile.last_name}`;
    // load grades/attendance similar to student script
  }
  window.accessStudent = accessStudent;

        
        function goBack() {
            document.getElementById('studentSelection').classList.remove('hidden');
            document.getElementById('studentDashboard').classList.add('hidden');
        }


  async function loadParentDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    // Get all linked students
    const { data: links, error } = await supabase
      .from('parent_links')
      .select('student_profile_id, profiles!inner(first_name, last_name, student_id)')
      .eq('parent_user_id', user.id);

    if (error) {
      alert('Failed to load students: ' + error.message);
      return;
    }

    const container = document.getElementById('linkedStudents');
    container.innerHTML = links.map(link => `
      <div class="p-4 border rounded mb-2">
        <strong>${link.profiles.first_name} ${link.profiles.last_name}</strong>
        <div>ID: ${link.profiles.student_id}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', loadParentDashboard);