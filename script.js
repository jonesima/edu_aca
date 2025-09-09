// Initialize Vanta.js background
VANTA.GLOBE({
 el: "#vanta-bg",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x4f46e5,
            backgroundColor: 0x111827,
            size: 0.8
        });

        // Initialize AOS
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true
        });

        // Initialize Feather Icons
        feather.replace();

