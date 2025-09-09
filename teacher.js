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