        AOS.init();
        feather.replace();
        
        function toggleSidebar() {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('open');
        }
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            const sidebar = document.querySelector('.sidebar');
            const toggleButton = document.querySelector('button[onclick="toggleSidebar()"]');
            
            if (window.innerWidth < 768 && 
                !sidebar.contains(event.target) && 
                !toggleButton.contains(event.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
        
        // Animate progress bars on page load
        document.addEventListener('DOMContentLoaded', function() {
            const progressBars = document.querySelectorAll('.progress-bar');
            progressBars.forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            });
        });

        
  import { supabase, getProfileByUserId } from './supabase-client.js';

  async function loadStudentDashboard() {
    try {
      // 1) get student_id from URL
      const params = new URLSearchParams(window.location.search);
      const student_id = params.get('student_id');
      const uid = params.get('uid');

      // 2) fetch profile
      let profile;
      if (uid) {
        profile = await getProfileByUserId(uid);
      } else if (student_id) {
        const { data, error } = await supabase.from('profiles').select('*').eq('student_id', student_id).maybeSingle();
        if (error) throw error;
        profile = data;
      }

      if (!profile) {
        document.body.innerHTML = '<div class="p-8">Profile not found. Please log in.</div>';
        return;
      }

      // populate header pieces
      document.getElementById('studentIdBadge').textContent = `ID: ${profile.student_id || '—'}`;
      document.getElementById('studentName').textContent = `${profile.first_name || ''} ${profile.last_name || ''}`;

      // 3) compute overall average from grades table
      const { data: gradesData, error: gradesErr } = await supabase
        .from('grades')
        .select('score')
        .eq('student_profile_id', profile.id);
      if (!gradesErr && gradesData && gradesData.length) {
        const avg = gradesData.reduce((s, r) => s + Number(r.score || 0), 0) / gradesData.length;
        const avgPercent = avg.toFixed(1) + '%';
        const avgEl = document.querySelector('.text-2xl.font-semibold'); // adapt selector if necessary
        if (avgEl) avgEl.textContent = `${avg.toFixed(1)}%`;
      }

      // 4) list assignments due (simple example)
      const { data: dueAssignments } = await supabase
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true })
        .limit(5);

      const container = document.getElementById('assignmentsList');
      if (container && dueAssignments) {
        container.innerHTML = dueAssignments.map(a => `
          <div class="p-3 border-b">
            <div class="font-medium">${a.title}</div>
            <div class="text-xs text-gray-500">Due: ${new Date(a.due_date).toLocaleString()}</div>
          </div>
        `).join('');
      }

      // 5) attendance summary
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, date')
        .eq('student_profile_id', profile.id)
        .order('date', { ascending: false })
        .limit(10);

      const attendEl = document.getElementById('attendanceList');
      if (attendEl && attendance) {
        attendEl.innerHTML = attendance.map(a => `<div class="text-sm">${a.date}: ${a.status}</div>`).join('');
      }

    } catch (err) {
      console.error(err);
      alert('Failed to load dashboard: ' + (err.message || err));
    }
  }

  document.addEventListener('DOMContentLoaded', loadStudentDashboard);