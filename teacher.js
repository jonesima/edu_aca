// teacher.js (module)
// Put this file at the same path referenced by dashboard-teacher.html
// Requires: /supabase-client.js to export `supabase` and `getProfileByUserId`

import { supabase, getProfileByUserId } from '/supabase-client.js';

AOS.init?.();
feather.replace?.();

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('open');
}
window.toggleSidebar = toggleSidebar;

// Close sidebar on mobile if clicked outside
document.addEventListener('click', (event) => {
  const sidebar = document.querySelector('.sidebar');
  const toggleButton = document.querySelector('button[onclick="toggleSidebar()"]');
  if (!sidebar || !toggleButton) return;
  if (window.innerWidth < 768 &&
      !sidebar.contains(event.target) &&
      !toggleButton.contains(event.target) &&
      sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
});

// --- Utilities ---
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function formatDateISO(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString();
}
function showAlert(msg) {
  // simple alert for now
  alert(msg);
}

// Helper: convert image URL -> dataURL (used for PDF logo/signature)
async function urlToDataURL(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load image for PDF:', err);
    return null;
  }
}

// --- Global preview state ---
let previewRows = [];
let previewHeaders = [];

// --- Initialization: load teacher profile & classes ---
(async function initTeacherDashboard() {
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    if (!uid) {
      console.warn('No uid in query string. Dashboard requires ?uid=');
      return;
    }

    // load profile
    let profile = null;
    try {
      profile = await getProfileByUserId(uid);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
    if (profile) {
      const nameEl = qs('.teacher-name');
      if (nameEl) nameEl.textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }

    // load classes for this teacher
    const { data: classes, error: classesErr } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', uid);

    if (classesErr) {
      console.error(classesErr);
      showAlert('Error loading classes.');
      return;
    }

    const classDropdown = qs('#class-dropdown');
    if (classDropdown) {
      classDropdown.innerHTML = classes.map(c => `<option value="${c.id}">${c.subject} - ${c.class_name}</option>`).join('');
      classDropdown.addEventListener('change', (e) => loadClassData(e.target.value));
      // populate assignment class selector too
      populateAssignmentClasses(classes);
      // load default
      if (classes.length) {
        await loadClassData(classes[0].id);
      }
    }

    // load deadlines + announcements initially
    await loadDeadlines(uid);
    await loadAnnouncements(uid);

    // wire other event handlers
    wireUIHandlers();

  } catch (err) {
    console.error('Initialization error:', err);
  }
})();

// --- Load class students, lesson plan, schedule ---
async function loadClassData(classId) {
  try {
    if (!classId) return;
    // load class meta (title, schedule, lesson plan) - if your DB has them otherwise keep defaults
    const { data: classMeta } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    if (classMeta) {
      qs('#class-title').textContent = `${classMeta.subject || 'Class'} - ${classMeta.class_name || ''}`;
      qs('#class-schedule').textContent = classMeta.schedule || 'Schedule not set';
      qs('#lesson-plan').textContent = classMeta.lesson_plan || 'No lesson plan for today.';
    }

    // students
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('last_name', { ascending: true });

    if (error) {
      console.error('Error loading students:', error);
      showAlert('Error loading students');
      return;
    }

    // fetch latest attendance & grades for these students (latest per student)
    // For simplicity, we'll fetch any attendance and grades and pick last by created_at
    const studentIds = (students || []).map(s => s.id);
    let attendance = [];
    let grades = [];
    if (studentIds.length) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .in('student_id', studentIds)
        .eq('class_id', classId);
      attendance = attData || [];

      const { data: gradeData } = await supabase
        .from('grades')
        .select('*')
        .in('student_id', studentIds)
        .eq('class_id', classId);
      grades = gradeData || [];
    }

    renderStudentsTable(students, attendance, grades);

  } catch (err) {
    console.error('loadClassData error:', err);
  }
}

function renderStudentsTable(students = [], attendance = [], grades = []) {
  const tbody = qs('#students-table');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-sm text-gray-500">No students in this class.</td></tr>`;
    return;
  }

  const rowsHtml = students.map(s => {
    // choose latest attendance and grade if present (by created_at)
    const attRecords = attendance.filter(a => String(a.student_id) === String(s.id));
    const latestAtt = attRecords.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const gradeRecords = grades.filter(g => String(g.student_id) === String(s.id));
    const latestGrade = gradeRecords.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];

    const attValue = latestAtt?.status || 'Present';
    const gradeValue = latestGrade?.score ?? '';

    return `
      <tr data-student-id="${s.id}">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <img class="h-10 w-10 rounded-full" src="${s.avatar_url || 'http://static.photos/people/200x200/3'}" alt="">
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">${s.first_name || ''} ${s.last_name || ''}</div>
              <div class="text-sm text-gray-500">ID: ${s.student_id || ''}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <select class="attendance-select px-2 py-1 border rounded-md" data-student="${s.id}">
            <option value="Present" ${attValue === 'Present' ? 'selected' : ''}>Present</option>
            <option value="Late" ${attValue === 'Late' ? 'selected' : ''}>Late</option>
            <option value="Absent" ${attValue === 'Absent' ? 'selected' : ''}>Absent</option>
          </select>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <input type="number" min="0" max="100" class="grade-input px-2 py-1 border border-gray-300 rounded-md" data-student="${s.id}" value="${gradeValue}">
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <button class="view-student text-indigo-600 hover:text-indigo-900" data-student="${s.id}">View</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

// --- Save changes handler (attendance + grades) ---
async function saveChanges() {
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const classId = qs('#class-dropdown')?.value;
    if (!classId) return showAlert('Select a class first');

    // gather attendance
    const attendanceEls = qsa('.attendance-select');
    const attPayload = attendanceEls.map(el => ({
      class_id: classId,
      student_id: el.dataset.student,
      status: el.value,
      teacher_id: uid,
      created_at: new Date().toISOString()
    }));

    // gather grades
    const gradeEls = qsa('.grade-input');
    const gradePayload = gradeEls.map(el => ({
      class_id: classId,
      student_id: el.dataset.student,
      score: el.value === '' ? null : Number(el.value),
      teacher_id: uid,
      created_at: new Date().toISOString()
    }));

    // Upsert attendance and grades in smaller batches to avoid large payloads
    // Use onConflict to update by class_id + student_id (assumes a unique constraint exists)
    for (const att of attPayload) {
      const { error } = await supabase.from('attendance').upsert(att, { onConflict: ['class_id', 'student_id'] });
      if (error) console.error('attendance upsert error', error);
    }
    for (const g of gradePayload) {
      const payload = { ...g };
      // if score is null, omit it? We'll upsert with null allowed
      const { error } = await supabase.from('grades').upsert(payload, { onConflict: ['class_id', 'student_id'] });
      if (error) console.error('grades upsert error', error);
    }

    showAlert('Changes saved!');
    // reload class data to refresh timestamps
    await loadClassData(classId);

  } catch (err) {
    console.error('saveChanges error', err);
    showAlert('Error saving changes.');
  }
}

// --- Deadlines (assignments) ---
async function loadDeadlines(uid) {
  try {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, title, due_date, status, class_id, classes(subject, class_name)')
      .eq('teacher_id', uid)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('loadDeadlines error', error);
      return;
    }

    const tbody = qs('#deadlines-table');
    if (!assignments?.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-sm text-gray-500">No upcoming deadlines.</td></tr>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = assignments.map(a => `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${a.title}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${a.classes?.subject || ''} - ${a.classes?.class_name || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateISO(a.due_date)}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${a.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : a.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">${a.status}</span>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('loadDeadlines error', err);
  }
}

async function createAssignment() {
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const title = qs('#assignment-title')?.value?.trim();
    const due = qs('#assignment-due')?.value;
    const classId = qs('#assignment-class')?.value;
    if (!title || !due || !classId) return showAlert('Please fill all assignment fields.');

    const { error } = await supabase.from('assignments').insert([{
      teacher_id: uid,
      title,
      due_date: due,
      status: 'Pending',
      class_id: classId
    }]);
    if (error) {
      console.error('createAssignment error', error);
      return showAlert('Error creating assignment.');
    }

    // hide form and clear
    qs('#assignment-form')?.classList.add('hidden');
    qs('#assignment-title').value = '';
    qs('#assignment-due').value = '';
    await loadDeadlines(uid);
    showAlert('Assignment created.');
  } catch (err) {
    console.error('createAssignment error', err);
  }
}

// --- Announcements ---
async function loadAnnouncements(uid) {
  try {
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('id, title, message, created_at')
      .eq('teacher_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadAnnouncements error', error);
      return;
    }

    const container = qs('#announcements-list');
    if (!announcements?.length) {
      if (container) container.innerHTML = `<p class="text-sm text-gray-500">No announcements yet.</p>`;
      return;
    }

    if (container) {
      container.innerHTML = announcements.map(a => `
        <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 class="text-sm font-semibold text-gray-900">${a.title}</h4>
          <p class="text-sm text-gray-600">${a.message}</p>
          <div class="text-xs text-gray-400">${new Date(a.created_at).toLocaleString()}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('loadAnnouncements error', err);
  }
}

async function createAnnouncement() {
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const title = qs('#announcement-title')?.value?.trim();
    const message = qs('#announcement-message')?.value?.trim();
    if (!title || !message) return showAlert('Please enter a title and message.');

    const { error } = await supabase.from('announcements').insert([{
      teacher_id: uid,
      title,
      message
    }]);

    if (error) {
      console.error('createAnnouncement error', error);
      return showAlert('Error posting announcement.');
    }

    qs('#announcement-form')?.classList.add('hidden');
    qs('#announcement-title').value = '';
    qs('#announcement-message').value = '';
    await loadAnnouncements(uid);
    showAlert('Announcement posted.');
  } catch (err) {
    console.error('createAnnouncement error', err);
  }
}

// --- Populate assignment class selector ---
function populateAssignmentClasses(classes = []) {
  const select = qs('#assignment-class');
  if (!select) return;
  select.innerHTML = classes.map(c => `<option value="${c.id}">${c.subject} - ${c.class_name}</option>`).join('');
}

// --- UI Wiring ---
function wireUIHandlers() {
  // Save changes
  const saveBtn = qs('#save-changes');
  if (saveBtn) saveBtn.addEventListener('click', saveChanges);

  // New assignment toggle
  const newAssignBtn = qs('#new-assignment-btn');
  if (newAssignBtn) newAssignBtn.addEventListener('click', () => {
    qs('#assignment-form')?.classList.toggle('hidden');
  });
  const saveAssignBtn = qs('#save-assignment');
  if (saveAssignBtn) saveAssignBtn.addEventListener('click', createAssignment);

  // New announcement toggle
  const newAnnBtn = qs('#new-announcement-btn');
  if (newAnnBtn) newAnnBtn.addEventListener('click', () => {
    qs('#announcement-form')?.classList.toggle('hidden');
  });
  const saveAnnBtn = qs('#save-announcement');
  if (saveAnnBtn) saveAnnBtn.addEventListener('click', createAnnouncement);

  // Report: generate preview (modal)
  const genBtn = qs('#generate-report');
  if (genBtn) genBtn.addEventListener('click', generateReportPreview);

  // Modal controls
  const closeModal = qs('#close-report-modal');
  if (closeModal) closeModal.addEventListener('click', closeReportModal);

  // Download & print buttons in modal
  const dlCsv = qs('#download-csv');
  if (dlCsv) dlCsv.addEventListener('click', downloadPreviewCSV);
  const dlPdf = qs('#download-pdf');
  if (dlPdf) dlPdf.addEventListener('click', downloadPreviewPDF);
  const prBtn = qs('#print-report');
  if (prBtn) prBtn.addEventListener('click', printPreviewReport);
}

// --- Report: Build preview rows, show modal ---
async function generateReportPreview() {
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const classId = qs('#class-dropdown')?.value;
    const filter = qs('#report-filter')?.value || 'all';
    const dataType = qs('#report-data-type')?.value || 'both';
    const startDate = qs('#report-start')?.value;
    const endDate = qs('#report-end')?.value;

    if (!classId) return showAlert('Select a class for report.');

    // Build queries with date filters
    let gradeQuery = supabase.from('grades').select('student_id, score, created_at').eq('class_id', classId);
    let attendanceQuery = supabase.from('attendance').select('student_id, status, created_at').eq('class_id', classId);

    if (startDate) {
      gradeQuery = gradeQuery.gte('created_at', startDate);
      attendanceQuery = attendanceQuery.gte('created_at', startDate);
    }
    if (endDate) {
      const endIso = endDate + 'T23:59:59';
      gradeQuery = gradeQuery.lte('created_at', endIso);
      attendanceQuery = attendanceQuery.lte('created_at', endIso);
    }

    const [{ data: grades }, { data: attendance }, { data: students }] = await Promise.all([
      gradeQuery,
      attendanceQuery,
      supabase.from('students').select('id, first_name, last_name, student_id').eq('class_id', classId)
    ]);

    if (!students?.length) return showAlert('No students in this class.');

    // Merge
    let rows = students.map(stu => {
      // pick the most relevant attendance/grade within range; for simplicity we pick last
      const att = (attendance || []).filter(a => String(a.student_id) === String(stu.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
      const gr = (grades || []).filter(g => String(g.student_id) === String(stu.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
      return {
        id: stu.id,
        student_id: stu.student_id,
        name: `${stu.first_name || ''} ${stu.last_name || ''}`.trim(),
        status: att?.status || '',
        score: gr?.score ?? ''
      };
    });

    // filters
    if (filter === 'absent') {
      rows = rows.filter(r => String(r.status).toLowerCase() === 'absent');
    } else if (filter === 'below50') {
      rows = rows.filter(r => {
        const sc = parseFloat(r.score);
        return !isNaN(sc) && sc < 50;
      });
    }

    if (!rows.length) return showAlert('No data available for this filter/date range.');

    previewRows = rows;
    // build headers based on dataType
    previewHeaders = ['Student ID', 'Name'];
    if (dataType === 'attendance' || dataType === 'both') previewHeaders.push('Attendance');
    if (dataType === 'grades' || dataType === 'both') previewHeaders.push('Grade');

    // render table in modal
    const container = qs('#report-preview-content');
    if (!container) return;
    const table = buildPreviewTableHTML(previewHeaders, previewRows, dataType);
    container.innerHTML = table;

    // show modal
    openReportModal();

  } catch (err) {
    console.error('generateReportPreview error', err);
    showAlert('Error generating report preview.');
  }
}

function buildPreviewTableHTML(headers, rows, dataType) {
  const head = headers.map(h => `<th class="px-4 py-2 text-left font-semibold">${h}</th>`).join('');
  const body = rows.map(r => {
    const cells = [r.student_id, r.name];
    if (dataType === 'attendance' || dataType === 'both') cells.push(r.status);
    if (dataType === 'grades' || dataType === 'both') cells.push(r.score);
    return `<tr>${cells.map(c => `<td class="px-4 py-2">${c}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200 text-sm"><thead class="bg-gray-50"><tr>${head}</tr></thead><tbody class="divide-y divide-gray-200">${body}</tbody></table></div>`;
}

function openReportModal() {
  const modal = qs('#report-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReportModal() {
  const modal = qs('#report-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// --- Download CSV from preview ---
function downloadPreviewCSV() {
  if (!previewRows?.length || !previewHeaders?.length) return showAlert('No preview available.');
  const filename = `class-report-${new Date().toISOString().slice(0,10)}.csv`;
  let csv = previewHeaders.join(',') + '\n';
  previewRows.forEach(r => {
    const row = [r.student_id, r.name];
    if (previewHeaders.includes('Attendance')) row.push(r.status);
    if (previewHeaders.includes('Grade')) row.push(r.score);
    csv += row.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Download PDF from preview (with logo, teacher/class info, principal signature & footer) ---
async function downloadPreviewPDF() {
  if (!previewRows?.length || !previewHeaders?.length) return showAlert('No preview available.');
  try {
    // ensure jsPDF is available
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return showAlert('PDF libraries not loaded.');

    const doc = new jsPDF();

    // load logo + signature as dataURLs
    const logoSrc = qs('#school-logo')?.src;
    const sigSrc = qs('#principal-signature')?.src;
    const logoData = await urlToDataURL(logoSrc).catch(()=>null);
    const sigData = await urlToDataURL(sigSrc).catch(()=>null);

    let cursorY = 14;
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', 14, 10, 24, 24); } catch(e){/*ignore*/ }
    }

    // header texts
    doc.setFontSize(14);
    doc.text('EduSphere Academy', 44, 18);
    doc.setFontSize(11);
    const teacherName = qs('.teacher-name')?.textContent || 'Teacher';
    const classText = qs('#class-dropdown')?.selectedOptions?.[0]?.textContent || 'Class';
    doc.text(`Teacher: ${teacherName}`, 14, 36);
    doc.text(`Class: ${classText}`, 110, 36);

    // table
    const startY = 45;
    const body = previewRows.map(r => {
      const row = [r.student_id, r.name];
      if (previewHeaders.includes('Attendance')) row.push(r.status);
      if (previewHeaders.includes('Grade')) row.push(String(r.score ?? ''));
      return row;
    });

    doc.autoTable({
      startY,
      head: [previewHeaders],
      body,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    // signature & footer
    const finalY = doc.lastAutoTable?.finalY || startY + 8;
    let sigY = finalY + 12;
    if (sigData) {
      try { doc.addImage(sigData, 'PNG', 14, sigY, 48, 20); } catch(e){/*ignore*/ }
    }
    doc.setFontSize(11);
    doc.text('Principal / Head of School', 14, sigY + 28);

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('This is a computer-generated report from EduSphere Academy.', 14, 285);

    doc.save(`class-report-${new Date().toISOString().slice(0,10)}.pdf`);

  } catch (err) {
    console.error('downloadPreviewPDF error', err);
    showAlert('Error creating PDF.');
  }
}

// --- Print preview (with logo, teacher/class info, signature, footer) ---
function printPreviewReport() {
  if (!previewRows?.length || !previewHeaders?.length) return showAlert('No preview available.');

  const teacherName = qs('.teacher-name')?.textContent || 'Teacher';
  const classText = qs('#class-dropdown')?.selectedOptions?.[0]?.textContent || 'Class';
  const logoSrc = qs('#school-logo')?.src || '';
  const sigSrc = qs('#principal-signature')?.src || '';

  const style = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      .header { display:flex; align-items:center; gap:20px; }
      .header img { height:60px; }
      h1 { margin:0; font-size:20px; }
      h3 { margin:0; font-weight:normal; color:#555; }
      table { width:100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border:1px solid #ddd; padding:8px; text-align:left; font-size:12px; }
      th { background: #4f46e5; color: #fff; }
      tr:nth-child(even) { background:#f9f9f9; }
      .signature { margin-top:30px; }
      .signature img { height:50px; }
      .footer { margin-top:20px; text-align:center; color:#666; font-size:12px; }
    </style>
  `;

  const header = `<div class="header">${logoSrc ? `<img src="${logoSrc}" alt="logo">` : ''}<div><h1>EduSphere Academy</h1><h3>Teacher: ${teacherName} | Class: ${classText}</h3></div></div>`;

  const tableHead = `<thead><tr>${previewHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const tableBody = `<tbody>${previewRows.map(r=>{
    const cells = [r.student_id, r.name];
    if (previewHeaders.includes('Attendance')) cells.push(r.status);
    if (previewHeaders.includes('Grade')) cells.push(r.score);
    return `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;
  }).join('')}</tbody>`;

  const signatureHtml = `<div class="signature">${sigSrc ? `<img src="${sigSrc}" alt="signature">` : ''}<div>Principal / Head of School</div></div>`;
  const footer = `<div class="footer">This is a computer-generated report from EduSphere Academy.</div>`;

  const html = style + header + `<table>${tableHead}${tableBody}</table>` + signatureHtml + footer;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}
