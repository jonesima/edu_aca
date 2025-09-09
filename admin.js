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


  import { supabase } from './supabase-client.js';

  document.getElementById('linkParentBtn').addEventListener('click', async () => {
    const parentId = document.getElementById('parentUserId').value.trim();
    const studentId = document.getElementById('studentReadableId').value.trim();

    if (!parentId || !studentId) {
      document.getElementById('linkParentStatus').textContent = 'Please enter both fields.';
      return;
    }

    try {
      const { error } = await supabase.rpc('link_parent_to_student', {
        p_parent_user_id: parentId,
        p_student_id: studentId
      });

      if (error) {
        throw error;
      }

      document.getElementById('linkParentStatus').textContent =
        `Parent successfully linked to student ${studentId}.`;
    } catch (err) {
      document.getElementById('linkParentStatus').textContent =
        `Error: ${err.message || err}`;
    }
  });