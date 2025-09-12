// teacher.js (ES module)
// Expects /supabase-client.js to export `supabase` (and optionally helper functions)
// Place this file where your dashboard html references it.

import { supabase } from '/supabase-client.js';

// ---------- Globals ----------
let currentTeacher = null;      // profile record
let currentClass = null;        // currently selected class object
let currentClassId = null;      // id string
let assignmentsData = [];       // all assignments loaded for this class
let previewHeaders = [];
let previewRows = [];

// If you prefer a hard-coded logo URL (no profile.logo_url), set schoolLogoUrl here.
// Otherwise ensure currentTeacher.logo_url is set in your profiles table.
let schoolLogoUrl = null; // e.g. "https://.../school-logo.png" or null to use profile.logo_url

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  feather.replace?.();
  if (AOS?.init) AOS.init();

  // wire common event handlers
  document.getElementById('save-changes').addEventListener('click', saveAttendanceAndGrades);
  document.getElementById('generate-report').addEventListener('click', generateReport);
  document.getElementById('close-report-modal').addEventListener('click', closeReportModal);
  document.getElementById('download-csv').addEventListener('click', downloadPreviewCSV);
  document.getElementById('download-pdf').addEventListener('click', downloadPreviewPDF);
  document.getElementById('print-report').addEventListener('click', printPreviewReport);

  // announcements
  document.getElementById('new-announcement-btn').addEventListener('click', () => {
    document.getElementById('announcement-form').classList.toggle('hidden');
  });
  document.getElementById('save-announcement').addEventListener('click', saveAnnouncement);

  // assignment toggles
  document.getElementById('new-assignment-btn').addEventListener('click', () => {
    const form = document.getElementById('assignment-form');
    form.classList.toggle('hidden');
    // reset create mode
    const btn = document.getElementById('save-assignment');
    btn.textContent = 'Create Assignment';
    btn.onclick = handleCreateAssignment;
  });

  // search & class filter for assignments
  document.getElementById('assignment-search').addEventListener('input', () => renderAssignments());
  document.getElementById('class-filter').addEventListener('change', () => renderAssignments());

  // exports
  document.getElementById('export-csv-btn').addEventListener('click', exportAssignmentsToCSV);
  document.getElementById('export-pdf-btn').addEventListener('click', exportAssignmentsToPDF);

  // report preview generate will open a modal preview
  // now load profile & classes
  await loadTeacherProfile();
  await loadClassesForTeacher();
});

// ---------- Helpers ----------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
function showAlert(msg){ alert(msg); }

// Convert image url -> dataURL (for jsPDF addImage)
async function urlToDataURL(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    const blob = await resp.blob();
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to fetch image for PDF:', err);
    return null;
  }
}

// ---------- Load profile ----------
async function loadTeacherProfile() {
  try {
    // Try supabase.auth.getUser (modern SDK)
    const { data: { user } = {} } = await supabase.auth.getUser?.() || {};
    if (!user) {
      console.warn('No authenticated user found via supabase.auth.getUser(). If you use uid query param, pass it in URL as ?uid=');
      // fallback to uid in query string for dev/testing
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      if (!uid) { return; }
      // load profile by user_id
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
      if (error) { console.error(error); return; }
      currentTeacher = data;
      qs('.teacher-name').textContent = `${data?.first_name || ''} ${data?.last_name || ''}`.trim();
      return;
    }

    // load profile row
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.error(error); }
    currentTeacher = data;
    if (currentTeacher) {
      qs('.teacher-name').textContent = `${currentTeacher.first_name || ''} ${currentTeacher.last_name || ''}`.trim();
      // if profile contains logo_url, set hidden img for PDF usage
      if (currentTeacher.logo_url) {
        qs('#school-logo').src = currentTeacher.logo_url;
      } else if (schoolLogoUrl) {
        qs('#school-logo').src = schoolLogoUrl;
      }
    }
  } catch (err) {
    console.error('loadTeacherProfile error', err);
  }
}

// ---------- Classes ----------
async function loadClassesForTeacher() {
  try {
    if (!currentTeacher?.user_id) {
      // maybe UID provided via querystring
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      if (!uid) return;
      currentTeacher = { user_id: uid };
    }
    const { data, error } = await supabase.from('classes').select('*').eq('teacher_id', currentTeacher.user_id).order('class_name');
    if (error) { console.error('loadClasses error', error); return; }
    const dropdown = qs('#class-dropdown');
    dropdown.innerHTML = '';
    if (!data?.length) {
      dropdown.innerHTML = '<option value="">No classes</option>';
      return;
    }
    data.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = `${cls.class_name} — ${cls.subject || ''}`;
      dropdown.appendChild(opt);
    });
    // set current class and load dependent data
    currentClassId = data[0].id;
    currentClass = data[0];
    dropdown.value = currentClassId;
    dropdown.addEventListener('change', async (e) => {
      currentClassId = e.target.value;
      currentClass = data.find(c => c.id === currentClassId) || null;
      await loadStudents();
      await loadAssignments();
      await loadAnnouncements();
    });

    // initial load
    await loadStudents();
    await loadAssignments();
    await loadAnnouncements();
  } catch (err) {
    console.error('loadClassesForTeacher', err);
  }
}

// ---------- Students (attendance & grades) ----------
async function loadStudents() {
  try {
    if (!currentClassId) return;
    const { data: students, error } = await supabase.from('students').select('*').eq('class_id', currentClassId).order('last_name');
    if (error) { console.error(error); return; }
    // load attendance & grades for these students
    const studentIds = (students || []).map(s => s.id);
    let attendance = [], grades = [];
    if (studentIds.length) {
      const { data: att } = await supabase.from('attendance').select('*').in('student_id', studentIds).eq('class_id', currentClassId);
      attendance = att || [];
      const { data: grd } = await supabase.from('grades').select('*').in('student_id', studentIds).eq('class_id', currentClassId);
      grades = grd || [];
    }
    renderStudentsTable(students, attendance, grades);
  } catch (err) {
    console.error('loadStudents', err);
  }
}

function renderStudentsTable(students = [], attendance = [], grades = []) {
  const tbody = qs('#students-table');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-sm text-gray-500">No students in this class.</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map(s => {
    const att = attendance.filter(a => String(a.student_id) === String(s.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    const grd = grades.filter(g => String(g.student_id) === String(s.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    const attVal = att?.status || 'Present';
    const gradeVal = grd?.score ?? '';
    return `
      <tr data-student-id="${s.id}">
        <td class="px-4 py-3">
          <div class="flex items-center">
            <img class="h-10 w-10 rounded-full" src="${s.avatar_url || 'http://static.photos/people/200x200/3'}" alt="">
            <div class="ml-3">
              <div class="text-sm font-medium">${s.first_name || ''} ${s.last_name || ''}</div>
              <div class="text-xs text-gray-500">ID: ${s.student_id || ''}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <select class="attendance-select border rounded px-2 py-1 text-sm" data-student="${s.id}">
            <option value="Present" ${attVal === 'Present' ? 'selected' : ''}>Present</option>
            <option value="Late" ${attVal === 'Late' ? 'selected' : ''}>Late</option>
            <option value="Absent" ${attVal === 'Absent' ? 'selected' : ''}>Absent</option>
          </select>
        </td>
        <td class="px-4 py-3">
          <input type="number" min="0" max="100" class="grade-input border rounded px-2 py-1 text-sm" data-student="${s.id}" value="${gradeVal}">
        </td>
      </tr>
    `;
  }).join('');
}

async function saveAttendanceAndGrades() {
  try {
    if (!currentClassId || !currentTeacher?.user_id) return showAlert('Select class / login');
    const attEls = qsa('.attendance-select');
    const gradeEls = qsa('.grade-input');

    // Upsert attendance and grades
    for (const el of attEls) {
      const payload = {
        student_id: el.dataset.student,
        class_id: currentClassId,
        teacher_id: currentTeacher.user_id,
        status: el.value,
        created_at: new Date().toISOString()
      };
      // upsert by (class_id, student_id)
      await supabase.from('attendance').upsert(payload, { onConflict: ['class_id', 'student_id'] });
    }
    for (const el of gradeEls) {
      const value = el.value;
      const payload = {
        student_id: el.dataset.student,
        class_id: currentClassId,
        teacher_id: currentTeacher.user_id,
        score: value === '' ? null : Number(value),
        created_at: new Date().toISOString()
      };
      await supabase.from('grades').upsert(payload, { onConflict: ['class_id', 'student_id'] });
    }

    showAlert('Saved attendance & grades.');
    await loadStudents();
  } catch (err) {
    console.error('saveAttendanceAndGrades', err);
    showAlert('Error saving data.');
  }
}

// ---------- Assignments (deadlines) ----------
async function loadAssignments() {
  try {
    if (!currentClassId) return;
    const { data, error } = await supabase
      .from('assignments')
      .select('*, classes(class_name)')
      .eq('class_id', currentClassId);

    if (error) { console.error(error); return; }
    // compute priority: 1=overdue,2=dueSoon,3=pending,4=completed
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    data.forEach(a => {
      const due = new Date(a.due_date);
      const daysDiff = Math.ceil((due - today) / (1000*60*60*24));
      if (a.status === 'Completed') a.priority = 4;
      else if (a.due_date < todayStr && a.status === 'Pending') a.priority = 1;
      else if (daysDiff <= 2 && daysDiff >= 0 && a.status === 'Pending') a.priority = 2;
      else a.priority = 3;
    });

    assignmentsData = data || [];
    populateClassFilter();
    renderAssignments();
  } catch (err) {
    console.error('loadAssignments', err);
  }
}

function populateClassFilter() {
  const select = qs('#class-filter');
  const unique = [...new Set(assignmentsData.map(a => a.classes?.class_name).filter(Boolean))];
  select.innerHTML = `<option value="all">All Classes</option>` + unique.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderAssignments(filter = null) {
  const tbody = qs('#deadlines-table');
  tbody.innerHTML = '';
  if (!assignmentsData.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-sm text-gray-500">No assignments.</td></tr>`;
    updateSummary();
    return;
  }
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const searchTerm = (qs('#assignment-search').value || '').toLowerCase();
  const classFilter = qs('#class-filter').value;

  // filter by search & class & status filter
  let filtered = assignmentsData.filter(a => {
    const matchesFilter = !filter || a.priority === filter;
    const inSearch = a.title.toLowerCase().includes(searchTerm) || (a.classes?.class_name || '').toLowerCase().includes(searchTerm);
    const matchesClass = classFilter === 'all' || (a.classes?.class_name === classFilter);
    return matchesFilter && inSearch && matchesClass;
  });

  // sort by priority then due date
  filtered.sort((a,b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  // render rows
  filtered.forEach(a => {
    const due = new Date(a.due_date);
    const daysDiff = Math.ceil((due - today) / (1000*60*60*24));
    let statusClass = '';
    if (a.status === 'Completed') statusClass = 'bg-green-100 text-green-700 px-2 py-1 rounded text-xs';
    else if (a.due_date < todayStr && a.status === 'Pending') statusClass = 'bg-red-100 text-red-700 px-2 py-1 rounded text-xs';
    else if (daysDiff <= 2 && daysDiff >= 0 && a.status === 'Pending') statusClass = 'bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs';
    else statusClass = 'bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2">${a.title}</td>
      <td class="px-4 py-2">${a.classes?.class_name || ''}</td>
      <td class="px-4 py-2">${a.due_date}</td>
      <td class="px-4 py-2"><span class="${statusClass}">${a.status}</span></td>
      <td class="px-4 py-2 space-x-2">
        <button class="edit-assignment px-2 py-1 text-xs bg-yellow-500 text-white rounded" data-id="${a.id}" data-title="${a.title}" data-due="${a.due_date}">Edit</button>
        ${a.status === 'Pending' ? `<button class="mark-complete px-2 py-1 text-xs bg-green-600 text-white rounded" data-id="${a.id}">Complete</button>` : `<span class="text-gray-500 text-sm">✔ Done</span>`}
        <button class="delete-assignment px-2 py-1 text-xs bg-red-600 text-white rounded" data-id="${a.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  attachAssignmentHandlers();
  updateSummary();
}

function attachAssignmentHandlers() {
  qsa('.edit-assignment').forEach(btn => btn.addEventListener('click', (e) => {
    const id = e.target.dataset.id, title = e.target.dataset.title, due = e.target.dataset.due;
    showEditAssignmentForm(id, title, due);
  }));
  qsa('.mark-complete').forEach(btn => btn.addEventListener('click', async (e) => {
    await markAssignmentComplete(e.target.dataset.id);
  }));
  qsa('.delete-assignment').forEach(btn => btn.addEventListener('click', async (e) => {
    if (!confirm('Delete assignment?')) return;
    await deleteAssignment(e.target.dataset.id);
  }));
}

async function handleCreateAssignment() {
  const title = qs('#assignment-title').value.trim();
  const due = qs('#assignment-due').value;
  if (!title || !due) return showAlert('Please fill title and due date.');
  await supabase.from('assignments').insert([{ teacher_id: currentTeacher.user_id, class_id: currentClassId, title, due_date: due, status: 'Pending' }]);
  qs('#assignment-title').value = ''; qs('#assignment-due').value = '';
  qs('#assignment-form').classList.add('hidden');
  await loadAssignments();
}

async function saveAssignment() { return handleCreateAssignment(); }
async function markAssignmentComplete(id) {
  const { error } = await supabase.from('assignments').update({ status: 'Completed' }).eq('id', id);
  if (error) console.error(error);
  await loadAssignments();
}
async function deleteAssignment(id) {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) console.error(error);
  await loadAssignments();
}
function showEditAssignmentForm(id, title, due) {
  const form = qs('#assignment-form');
  form.classList.remove('hidden');
  qs('#assignment-title').value = title;
  qs('#assignment-due').value = due;
  const btn = qs('#save-assignment');
  btn.textContent = 'Update Assignment';
  btn.onclick = () => updateAssignment(id);
}
async function updateAssignment(id) {
  const title = qs('#assignment-title').value.trim();
  const due = qs('#assignment-due').value;
  if (!title || !due) return showAlert('Please fill title and due date.');
  const { error } = await supabase.from('assignments').update({ title, due_date: due }).eq('id', id);
  if (error) { console.error(error); showAlert('Error updating.'); return; }
  qs('#assignment-title').value = ''; qs('#assignment-due').value = '';
  qs('#save-assignment').textContent = 'Create Assignment';
  qs('#save-assignment').onclick = handleCreateAssignment;
  qs('#assignment-form').classList.add('hidden');
  await loadAssignments();
}

// ---------- Announcements ----------
async function loadAnnouncements() {
  try {
    if (!currentTeacher?.user_id) return;
    const { data, error } = await supabase.from('announcements').select('*').eq('teacher_id', currentTeacher.user_id).order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    const container = qs('#announcements-list');
    container.innerHTML = data.map(a => `<div class="p-3 border rounded bg-gray-50"><h4 class="font-semibold">${a.title}</h4><p class="text-sm">${a.message}</p><div class="text-xs text-gray-400">${new Date(a.created_at).toLocaleString()}</div></div>`).join('');
  } catch (err) {
    console.error('loadAnnouncements', err);
  }
}
async function saveAnnouncement() {
  try {
    const title = qs('#announcement-title').value.trim();
    const message = qs('#announcement-message').value.trim();
    if (!title || !message) return showAlert('Please enter title & message.');
    await supabase.from('announcements').insert([{ teacher_id: currentTeacher.user_id, title, message }]);
    qs('#announcement-title').value=''; qs('#announcement-message').value='';
    qs('#announcement-form').classList.add('hidden');
    await loadAnnouncements();
  } catch (err) { console.error('saveAnnouncement', err); showAlert('Error posting announcement'); }
}

// ---------- Summary & Progress ----------
function updateSummary() {
  const overdueCount = assignmentsData.filter(a => a.priority === 1).length;
  const dueSoonCount = assignmentsData.filter(a => a.priority === 2).length;
  const pendingCount = assignmentsData.filter(a => a.priority === 3).length;
  const completedCount = assignmentsData.filter(a => a.priority === 4).length;
  const totalCount = assignmentsData.length || 1;
  const completedPercent = Math.round((completedCount / totalCount) * 100);

  const summary = qs('#deadlines-summary');
  summary.innerHTML = `
    <span class="text-red-600 cursor-pointer" data-filter="1">${overdueCount} Overdue</span> ·
    <span class="text-orange-600 cursor-pointer" data-filter="2">${dueSoonCount} Due Soon</span> ·
    <span class="text-yellow-600 cursor-pointer" data-filter="3">${pendingCount} Pending</span> ·
    <span class="text-green-600 cursor-pointer" data-filter="4">${completedCount} Completed</span> ·
    <span class="text-blue-600 cursor-pointer" data-filter="all">Show All</span>
  `;

  // make summary clickable
  qsa('#deadlines-summary span').forEach(s => {
    s.onclick = (e) => {
      const f = e.target.dataset.filter;
      renderAssignments(f === 'all' ? null : Number(f));
    };
  });

  // progress bar
  const progressBar = qs('#deadlines-progress');
  progressBar.style.width = `${completedPercent}%`;
  progressBar.className = 'h-3 rounded-full ' + (completedPercent === 100 ? 'bg-green-600' : (completedPercent >= 50 ? 'bg-blue-500' : 'bg-yellow-500'));
  progressBar.parentElement.onclick = () => renderAssignments(null);
}

// ---------- Assignment Search / Class filter handled in renderAssignments/populateClassFilter ----------

// ---------- Export CSV (assignments) ----------
function exportAssignmentsToCSV() {
  if (!assignmentsData.length) return showAlert('No assignments to export');
  const headers = ['Title','Class','Due Date','Status'];
  const rows = assignmentsData.map(a => [`"${a.title.replace(/"/g,'""')}"`,`"${(a.classes?.class_name||'').replace(/"/g,'""')}"`, a.due_date, a.status]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `assignments_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

// ---------- Export PDF (grouped, color-coded, includes logo + teacher + class info + summary + completion %) ----------
async function exportAssignmentsToPDF() {
  if (!assignmentsData.length) return showAlert('No assignments to export');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // add logo (profile.logo_url takes precedence; fallback to schoolLogoUrl)
    const logoUrl = currentTeacher?.logo_url || schoolLogoUrl || qs('#school-logo')?.src || null;
    if (logoUrl) {
      const dataUrl = await urlToDataURL(logoUrl).catch(()=>null);
      if (dataUrl) {
        try { doc.addImage(dataUrl, 'PNG', 160, 8, 36, 18); } catch(e){ /* noop */ }
      }
    }

    // Title & teacher/class
    doc.setFontSize(16); doc.setTextColor(0,0,0);
    doc.text('Assignments Report', 14, 20);

    doc.setFontSize(11); doc.setTextColor(60,60,60);
    doc.text(`Teacher: ${currentTeacher?.first_name || ''} ${currentTeacher?.last_name || ''}`, 14, 28);
    if (currentClass) doc.text(`Class: ${currentClass.class_name} (${currentClass.subject || ''})`, 14, 34);

    doc.setFontSize(9); doc.setTextColor(100,100,100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);

    // summary counts & completion
    const overdueCount = assignmentsData.filter(a=>a.priority===1).length;
    const dueSoonCount = assignmentsData.filter(a=>a.priority===2).length;
    const pendingCount = assignmentsData.filter(a=>a.priority===3).length;
    const completedCount = assignmentsData.filter(a=>a.priority===4).length;
    const totalCount = assignmentsData.length;
    const completedPercent = Math.round((completedCount/ (totalCount||1)) * 100);

    doc.setFontSize(11);
    doc.setTextColor(200,0,0); doc.text(`Overdue: ${overdueCount}`, 14, 50);
    doc.setTextColor(255,140,0); doc.text(`Due Soon: ${dueSoonCount}`, 60, 50);
    doc.setTextColor(200,200,0); doc.text(`Pending: ${pendingCount}`, 120, 50);
    doc.setTextColor(0,150,0); doc.text(`Completed: ${completedCount}`, 170, 50);

    doc.setFontSize(9); doc.setTextColor(0,0,0);
    doc.text(`Total: ${totalCount}`, 14, 56);
    doc.text(`Completion: ${completedPercent}%`, 60, 56);

    // grouped sections
    const groups = [
      { name: 'Overdue', color: [200,0,0], data: assignmentsData.filter(a=>a.priority===1) },
      { name: 'Due Soon', color: [255,140,0], data: assignmentsData.filter(a=>a.priority===2) },
      { name: 'Pending', color: [200,200,0], data: assignmentsData.filter(a=>a.priority===3) },
      { name: 'Completed', color: [0,150,0], data: assignmentsData.filter(a=>a.priority===4) },
    ];

    let startY = 70;
    for (const group of groups) {
      if (!group.data.length) continue;
      doc.setFontSize(12); doc.setTextColor(...group.color);
      doc.text(group.name, 14, startY);
      startY += 6;
      const rows = group.data.map(a => [a.title, a.classes?.class_name || '', a.due_date, a.status]);
      if (doc.autoTable) {
        doc.autoTable({
          head: [['Title','Class','Due Date','Status']],
          body: rows,
          startY,
          theme: 'grid',
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });
        startY = doc.lastAutoTable.finalY + 10;
      } else {
        rows.forEach(r => { doc.setTextColor(0,0,0); doc.text(r.join(' | '), 14, startY); startY += 7; });
        startY += 10;
      }
    }

    doc.save(`assignments_report_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (err) {
    console.error('exportAssignmentsToPDF', err);
    showAlert('Error creating PDF');
  }
}

// ---------- Report preview (students attendance/grades) ----------
async function generateReport() {
  try {
    const classId = currentClassId;
    if (!classId) return showAlert('Select a class');
    const filter = qs('#report-filter').value;
    const type = qs('#report-data-type').value;
    const startDate = qs('#report-start').value;
    const endDate = qs('#report-end').value;

    // build queries with optional date filters
    let gradeQuery = supabase.from('grades').select('student_id, score, created_at').eq('class_id', classId);
    let attendanceQuery = supabase.from('attendance').select('student_id, status, created_at').eq('class_id', classId);
    if (startDate) { gradeQuery = gradeQuery.gte('created_at', startDate); attendanceQuery = attendanceQuery.gte('created_at', startDate); }
    if (endDate) { const endIso = endDate + 'T23:59:59'; gradeQuery = gradeQuery.lte('created_at', endIso); attendanceQuery = attendanceQuery.lte('created_at', endIso); }

    const [ { data: grades }, { data: attendance }, { data: students } ] = await Promise.all([gradeQuery, attendanceQuery, supabase.from('students').select('id, first_name, last_name, student_id').eq('class_id', classId)]);

    if (!students?.length) return showAlert('No students.');

    let rows = students.map(stu => {
      const att = (attendance || []).filter(a => String(a.student_id) === String(stu.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
      const gr = (grades || []).filter(g => String(g.student_id) === String(stu.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
      return { id: stu.id, student_id: stu.student_id, name: `${stu.first_name} ${stu.last_name}`, status: att?.status || '', score: gr?.score ?? '' };
    });

    if (filter === 'absent') rows = rows.filter(r => String(r.status).toLowerCase() === 'absent');
    if (filter === 'below50') rows = rows.filter(r => { const s = parseFloat(r.score); return !isNaN(s) && s < 50; });
    if (!rows.length) return showAlert('No data for this filter/date range.');

    previewRows = rows;
    previewHeaders = ['Student ID','Name'];
    if (type === 'attendance' || type === 'both') previewHeaders.push('Attendance');
    if (type === 'grades' || type === 'both') previewHeaders.push('Grade');

    // render preview table
    const container = qs('#report-preview-content');
    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50"><tr>${previewHeaders.map(h=>`<th class="px-4 py-2 text-left font-semibold">${h}</th>`).join('')}</tr></thead>
          <tbody class="divide-y divide-gray-200">
            ${previewRows.map(r => {
              const cells = [r.student_id, r.name];
              if (previewHeaders.includes('Attendance')) cells.push(r.status);
              if (previewHeaders.includes('Grade')) cells.push(r.score);
              return `<tr>${cells.map(c=>`<td class="px-4 py-2">${c}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    // show modal
    qs('#report-modal').classList.remove('hidden');
    qs('#report-modal').classList.add('flex');
  } catch (err) {
    console.error('generateReport', err);
    showAlert('Error generating report.');
  }
}

function closeReportModal(){ qs('#report-modal').classList.add('hidden'); qs('#report-modal').classList.remove('flex'); }

function downloadPreviewCSV() {
  if (!previewRows?.length) return showAlert('No preview');
  const csvHeader = previewHeaders.join(',');
  const csvBody = previewRows.map(r => {
    const arr = [r.student_id, r.name];
    if (previewHeaders.includes('Attendance')) arr.push(r.status);
    if (previewHeaders.includes('Grade')) arr.push(r.score);
    return arr.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
  }).join('\n');
  const blob = new Blob([csvHeader+'\n'+csvBody], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `class-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

async function downloadPreviewPDF() {
  if (!previewRows?.length) return showAlert('No preview');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // header
    doc.setFontSize(14); doc.text('Class Report', 14, 20);
    // table
    const rows = previewRows.map(r => {
      const row = [r.student_id, r.name];
      if (previewHeaders.includes('Attendance')) row.push(r.status);
      if (previewHeaders.includes('Grade')) row.push(String(r.score ?? ''));
      return row;
    });
    doc.autoTable({ startY: 30, head: [previewHeaders], body: rows, styles: { fontSize: 9 } });
    doc.save(`class-report-${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (err) { console.error(err); showAlert('Error creating PDF'); }
}

function printPreviewReport() {
  if (!previewRows?.length) return showAlert('No preview');
  const win = window.open('','_blank');
  const html = `<html><head><title>Report</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#4f46e5;color:#fff}</style></head><body>${qs('#report-preview-content').innerHTML}</body></html>`;
  win.document.write(html); win.document.close(); win.focus(); win.print(); win.close();
}

// ---------- End of file ----------
