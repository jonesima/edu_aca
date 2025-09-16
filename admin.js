// =====================================================
// admin.js – Full Admin Dashboard Logic  (with live Avg Performance)
// =====================================================
import { supabase } from './supabase-client.js';

// ------------------- INITIALISE -------------------
document.addEventListener('DOMContentLoaded', () => {
  AOS.init();
  feather.replace();
  loadModule('dashboard'); // default module
});

// ------------------- SIDEBAR ----------------------
export function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
}

document.getElementById('sideNav').addEventListener('click', (e) => {
  const link = e.target.closest('a.nav-link');
  if (!link) return;
  e.preventDefault();
  // highlight
  document.querySelectorAll('#sideNav a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
  // load module
  const module = link.getAttribute('href').slice(1);
  loadModule(module);
});

// ------------------- MODULE LOADER -----------------
async function loadModule(name) {
  document.getElementById('pageTitle').textContent = capitalize(name);
  const container = document.getElementById('moduleContainer');

  switch (name) {
    case 'dashboard': container.innerHTML = await dashboardContent(); break;
    case 'students':  container.innerHTML = await studentsContent();  break;
    case 'teachers':  container.innerHTML = await teachersContent();  break;
    case 'classes':   container.innerHTML = await classesContent();   break;
    case 'reports':   container.innerHTML = await reportsContent();   break;
    case 'settings':  container.innerHTML = settingsContent();        break;
  }
  feather.replace();
  wireModuleEvents(name); // attach module-specific listeners
}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// ===================================================
// DASHBOARD CONTENT  (Live stats + live Avg Performance)
// ===================================================
async function dashboardContent() {
  const studentCount = await countRows('students');
  const teacherCount = await countRows('profiles', { role:'teacher' });
  const classCount   = await countRows('classes');

  // -------- NEW: calculate average performance from grades --------
  let avgPerf = '—';
  try {
    const { data, error } = await supabase.from('grades').select('score');
    if (!error && data?.length) {
      const total = data.reduce((sum, g) => sum + (g.score || 0), 0);
      avgPerf = (total / data.length).toFixed(1) + '%';
    }
  } catch (err) {
    console.error('Error computing average performance:', err);
  }
  // ----------------------------------------------------------------

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      ${statCard('users','Total Students',studentCount)}
      ${statCard('user-check','Teachers',teacherCount)}
      ${statCard('book','Classes',classCount)}
      ${statCard('bar-chart-2','Avg. Performance','${avgPerf}')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div class="lg:col-span-2 bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <ul id="recentActivity" class="divide-y divide-gray-200"></ul>
      </div>

      <div class="bg-white rounded-xl shadow-md p-6">
        <h2 class="text-xl font-semibold mb-4">Link Parent to Student</h2>
        <div class="grid grid-cols-1 gap-4">
          <input id="parentUserId" type="text" placeholder="Parent User UUID" class="border p-2 rounded">
          <input id="studentReadableId" type="text" placeholder="Student ID" class="border p-2 rounded">
        </div>
        <button id="linkParentBtn" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Link Parent</button>
        <div id="linkParentStatus" class="mt-3 text-sm text-gray-600"></div>
      </div>
    </div>
  `;
}
async function loadRecentActivity() {
  const { data, error } = await supabase.from('recent_activity').select('*').order('created_at',{ascending:false}).limit(5);
  if (error) return;
  const list = document.getElementById('recentActivity');
  if (!list) return;
  list.innerHTML = data.map(i => `
    <li class="py-2 flex space-x-3">
      <i data-feather="${i.icon||'activity'}" class="h-5 w-5 text-indigo-500"></i>
      <div><p class="text-sm font-medium">${i.description}</p>
      <p class="text-xs text-gray-500">${new Date(i.created_at).toLocaleString()}</p></div>
    </li>`).join('');
  feather.replace();
}

// ===================================================
// STUDENTS MODULE
// ===================================================
async function studentsContent() {
  const { data } = await supabase.from('students').select('id,name,grade,email');
  const rows = (data||[]).map(s => `
      <tr class="border-b">
        <td class="p-2">${s.name}</td>
        <td class="p-2">${s.grade}</td>
        <td class="p-2">${s.email}</td>
        <td class="p-2 text-right"><button data-id="${s.id}" class="delStudent text-red-600">Delete</button></td>
      </tr>`).join('');
  return `
    <div class="flex justify-between mb-4">
      <h2 class="text-xl font-semibold">Students</h2>
      <button id="addStudentBtn" class="bg-indigo-600 text-white px-3 py-1 rounded">Add Student</button>
    </div>
    <table class="min-w-full bg-white rounded shadow">
      <thead class="bg-gray-200"><tr>
        <th class="p-2 text-left">Name</th>
        <th class="p-2 text-left">Grade</th>
        <th class="p-2 text-left">Email</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
async function addStudent() {
  const name = prompt('Student Name?'); if(!name) return;
  const grade = prompt('Grade?'); if(!grade) return;
  const email = prompt('Email?'); if(!email) return;
  const { error } = await supabase.from('students').insert([{name,grade,email}]);
  if (!error) loadModule('students');
}
async function deleteStudent(id) {
  if (!confirm('Delete this student?')) return;
  await supabase.from('students').delete().eq('id',id);
  loadModule('students');
}

// ===================================================
// TEACHERS MODULE
// ===================================================
async function teachersContent() {
  const { data } = await supabase.from('profiles').select('id,name,email,subject').eq('role','teacher');
  const rows = (data||[]).map(t => `
    <tr class="border-b">
      <td class="p-2">${t.name}</td>
      <td class="p-2">${t.subject||''}</td>
      <td class="p-2">${t.email}</td>
    </tr>`).join('');
  return `
    <h2 class="text-xl font-semibold mb-4">Teachers</h2>
    <table class="min-w-full bg-white rounded shadow">
      <thead class="bg-gray-200"><tr>
        <th class="p-2 text-left">Name</th>
        <th class="p-2 text-left">Subject</th>
        <th class="p-2 text-left">Email</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ===================================================
// CLASSES MODULE
// ===================================================
async function classesContent() {
  const { data } = await supabase.from('classes').select('id,class_name,teacher');
  const rows = (data||[]).map(c => `
    <tr class="border-b">
      <td class="p-2">${c.class_name}</td>
      <td class="p-2">${c.teacher}</td>
    </tr>`).join('');
  return `
    <h2 class="text-xl font-semibold mb-4">Classes</h2>
    <table class="min-w-full bg-white rounded shadow">
      <thead class="bg-gray-200"><tr>
        <th class="p-2 text-left">Class</th>
        <th class="p-2 text-left">Teacher</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ===================================================
// REPORTS MODULE
// ===================================================
async function reportsContent() {
  const sCount = await countRows('students');
  const tCount = await countRows('profiles',{role:'teacher'});
  const cCount = await countRows('classes');
  return `
    <h2 class="text-xl font-semibold mb-4">Reports</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${statCard('users','Total Students',sCount)}
      ${statCard('user-check','Teachers',tCount)}
      ${statCard('book','Classes',cCount)}
    </div>
    <p class="mt-6 text-gray-600">Use these numbers for end-of-term summaries or export as needed.</p>`;
}

// ===================================================
// SETTINGS MODULE
// ===================================================
function settingsContent() {
  return `
    <h2 class="text-xl font-semibold mb-4">Settings</h2>
    <div class="bg-white rounded shadow p-4 w-full md:w-1/2">
      <label class="block mb-2 text-sm">Admin Name</label>
      <input id="adminName" class="border p-2 rounded w-full mb-4" value="Admin User">
      <label class="block mb-2 text-sm">Email</label>
      <input id="adminEmail" class="border p-2 rounded w-full mb-4" value="admin@example.com">
      <button id="saveSettings" class="bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
      <div id="settingsStatus" class="mt-3 text-sm text-gray-600"></div>
    </div>`;
}
function saveSettings() {
  const name = document.getElementById('adminName').value.trim();
  const email = document.getElementById('adminEmail').value.trim();
  document.getElementById('settingsStatus').textContent =
    `Saved! Name: ${name}, Email: ${email}`;
}

// ===================================================
// UTILS
// ===================================================
function statCard(icon,label,val){
  return `<div class="bg-white rounded-lg shadow p-6 text-center">
    <i data-feather="${icon}" class="mx-auto h-6 w-6 text-indigo-500"></i>
    <p class="mt-2 text-sm text-gray-600">${label}</p>
    <p class="text-2xl font-semibold text-gray-900">${val ?? '—'}</p>
  </div>`;
}
async function countRows(table, filter={}) {
  let q = supabase.from(table).select('*',{count:'exact',head:true});
  for (const [k,v] of Object.entries(filter)) q = q.eq(k,v);
  const { count } = await q;
  return count;
}

// ===================================================
// WIRE EVENTS PER MODULE AFTER CONTENT LOAD
// ===================================================
function wireModuleEvents(name){
  if(name==='dashboard'){
    loadRecentActivity();
    wireParentLink();
  }
  if(name==='students'){
    document.getElementById('addStudentBtn')?.addEventListener('click',addStudent);
    document.querySelectorAll('.delStudent').forEach(btn =>
      btn.addEventListener('click', () => deleteStudent(btn.dataset.id))
    );
  }
  if(name==='settings'){
    document.getElementById('saveSettings')?.addEventListener('click',saveSettings);
  }
}

// Existing parent linking for dashboard
function wireParentLink() {
  document.getElementById('linkParentBtn')?.addEventListener('click', async () => {
    const parentId = document.getElementById('parentUserId').value.trim();
    const studentId = document.getElementById('studentReadableId').value.trim();
    const statusEl = document.getElementById('linkParentStatus');

    if (!parentId || !studentId) {
      statusEl.textContent = 'Please enter both fields.';
      statusEl.className = 'mt-3 text-sm text-red-600';
      return;
    }
    try {
      const { error } = await supabase.rpc('link_parent_to_student', {
        p_parent_user_id: parentId,
        p_student_id: studentId
      });
      if (error) throw error;
      statusEl.textContent = `Parent successfully linked to student ${studentId}.`;
      statusEl.className = 'mt-3 text-sm text-green-600';
    } catch (err) {
      statusEl.textContent = `Error: ${err.message || err}`;
      statusEl.className = 'mt-3 text-sm text-red-600';
    }
  });
}
