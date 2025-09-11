AOS.init();
feather.replace();

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function (event) {
  const sidebar = document.querySelector('.sidebar');
  const toggleButton = document.querySelector('button[onclick="toggleSidebar()"]');

  if (
    window.innerWidth < 768 &&
    !sidebar.contains(event.target) &&
    !toggleButton.contains(event.target) &&
    sidebar.classList.contains('open')
  ) {
    sidebar.classList.remove('open');
  }
});

// Animate progress bars on page load
document.addEventListener('DOMContentLoaded', function () {
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
    // 1) get student_id or uid from URL
    const params = new URLSearchParams(window.location.search);
    const student_id = params.get('student_id');
    const uid = params.get('uid');

    // 2) fetch profile
    let profile;
    if (uid) {
      profile = await getProfileByUserId(uid);
    } else if (student_id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('student_id', student_id)
        .maybeSingle();
      if (error) throw error;
      profile = data;
    }

    if (!profile) {
      document.body.innerHTML = '<div class="p-8">Profile not found. Please log in.</div>';
      return;
    }

    // populate header
    document.getElementById('studentIdBadge').textContent = `ID: ${profile.student_id || '—'}`;
    document.getElementById('studentName').textContent = `${profile.first_name || ''} ${profile.last_name || ''}`;

    // 3) compute overall average from grades table
    const { data: gradesData, error: gradesErr } = await supabase
      .from('grades')
      .select('score')
      .eq('student_profile_id', profile.id);

    if (!gradesErr && gradesData && gradesData.length) {
      const avg = gradesData.reduce((s, r) => s + Number(r.score || 0), 0) / gradesData.length;
      const avgEl = document.querySelector('.text-2xl.font-semibold');
      if (avgEl) avgEl.textContent = `${avg.toFixed(1)}%`;
    }

    // 4) list assignments
    const { data: dueAssignments } = await supabase
      .from('assignments')
      .select('*')
      .eq('student_profile_id', profile.id)
      .order('due_date', { ascending: true })
      .limit(5);

    const container = document.getElementById('assignmentsList');
    if (container) {
      if (dueAssignments && dueAssignments.length) {
        container.innerHTML = dueAssignments
          .map(
            a => `
          <div class="p-3 border-b">
            <div class="font-medium">${a.title}</div>
            <div class="text-xs text-gray-500">Due: ${new Date(a.due_date).toLocaleDateString()}</div>
          </div>
        `
          )
          .join('');
      } else {
        container.innerHTML = `<p class="text-sm text-gray-500">No upcoming assignments.</p>`;
      }
    }

    // 5) attendance summary
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status, date')
      .eq('student_profile_id', profile.id)
      .order('date', { ascending: false })
      .limit(10);

    const attendEl = document.getElementById('attendanceList');
    if (attendEl) {
      if (attendance && attendance.length) {
        attendEl.innerHTML = attendance
          .map(a => `<div class="text-sm">${new Date(a.date).toLocaleDateString()}: ${a.status}</div>`)
          .join('');
      } else {
        attendEl.innerHTML = `<p class="text-sm text-gray-500">No attendance records.</p>`;
      }
    }

    // 6) fetch announcements
    const { data: announcements } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const annEl = document.getElementById('announcementsList');
    if (annEl) {
      if (announcements && announcements.length) {
        annEl.innerHTML = announcements
          .map(
            a => `
          <div class="p-3 bg-blue-50 rounded-lg mb-2">
            <p class="text-sm font-medium text-gray-900">${a.title}</p>
            <p class="text-xs text-gray-500">${a.content}</p>
            <p class="text-xs text-gray-400 mt-1">Posted: ${new Date(a.created_at).toLocaleDateString()}</p>
          </div>
        `
          )
          .join('');
      } else {
        annEl.innerHTML = `<p class="text-sm text-gray-500">No announcements yet.</p>`;
      }
    }

    // 7) fetch timetable for today
    const today = new Date().toISOString().split('T')[0];
    const { data: timetable } = await supabase
      .from('timetable')
      .select('*')
      .eq('student_profile_id', profile.id)
      .eq('date', today)
      .order('start_time', { ascending: true });

    const timeTableEl = document.getElementById('timetableList');
    if (timeTableEl) {
      if (timetable && timetable.length) {
        timeTableEl.innerHTML = timetable
          .map(
            t => `
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
            <div>
              <p class="text-sm font-medium text-gray-900">${t.subject}</p>
              <p class="text-xs text-gray-500">Room ${t.room} • ${t.start_time} - ${t.end_time}</p>
            </div>
          </div>
        `
          )
          .join('');
      } else {
        timeTableEl.innerHTML = `<p class="text-sm text-gray-500">No classes scheduled today.</p>`;
      }
    }
  } catch (err) {
    console.error(err);
    alert('Failed to load dashboard: ' + (err.message || err));
  }
}

document.addEventListener('DOMContentLoaded', loadStudentDashboard);
