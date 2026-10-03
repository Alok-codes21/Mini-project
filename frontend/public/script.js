document.addEventListener("DOMContentLoaded", () => {

    console.log("MathVision AI website loaded successfully!");

    const themeToggle = document.querySelector(".theme-toggle");
    const themeIcon = document.querySelector(".theme-icon");

    const applyTheme = (isDark) => {
        document.body.classList.toggle("dark", isDark);
        if (themeIcon) {
            themeIcon.innerHTML = isDark
                ? '<i class="fa-solid fa-sun" style="color: rgb(116, 192, 252);"></i>'
                : '<i class="fa-solid fa-moon"></i>';
        }
        if (themeToggle) {
            themeToggle.setAttribute("aria-pressed", String(isDark));
        }
    };

    const savedTheme = localStorage.getItem("mathvision-theme");
    if (savedTheme === "dark") {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const isDark = !document.body.classList.contains("dark");
            applyTheme(isDark);
            localStorage.setItem("mathvision-theme", isDark ? "dark" : "light");
        });
    }

    const startButton = document.querySelector(".primary-btn");

    if (startButton) {
        startButton.addEventListener("click", () => {
            alert("Welcome to MathVision! Choose a module to start learning.");
        });
    }

    const exploreButton = document.querySelector(".secondary-btn");

    if (exploreButton) {
        exploreButton.addEventListener("click", () => {
            document.querySelector(".modules").scrollIntoView({
                behavior: "smooth"
            });
        });
    }

    const featureCards = document.querySelectorAll(".feature-card");
    const closeButtons = document.querySelectorAll(".close-popup-btn");
    const popupOverlays = document.querySelectorAll(".popup-overlay");

    featureCards.forEach(card => {
        card.addEventListener("click", () => {
            const targetPopupId = card.getAttribute("data-popup");
            const matchedPopup = document.getElementById(targetPopupId);

            if (matchedPopup) {
                matchedPopup.classList.remove("hidden");
                document.body.style.overflow = "hidden";
            }
        });
    });

    closeButtons.forEach(button => {
        button.addEventListener("click", () => {
            const activeOverlay = button.closest(".popup-overlay");
            if (activeOverlay) {
                activeOverlay.classList.add("hidden");
                document.body.style.overflow = "";
            }
        });
    });

    popupOverlays.forEach(overlay => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                overlay.classList.add("hidden");
                document.body.style.overflow = "";
            }
        });
    });

    const cards = document.querySelectorAll(".module-card");

    cards.forEach(card => {
        card.addEventListener("mouseenter", () => {
            card.style.transform = "translateY(-10px)";
        });

        card.addEventListener("mouseleave", () => {
            card.style.transform = "translateY(0)";
        });
    });
});
