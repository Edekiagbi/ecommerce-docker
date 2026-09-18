/**
 * Nest landing interactions.
 * Loaded at the end of the footer template.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    initSearchToggle();
    initCategoryTabs();
    initStarRatings();
    initTestimonialCarousel();
    initNewsletter();
  });

  /* Mobile navigation */
  function initMobileNav() {
    var burger = document.getElementById("nestBurger");
    var links = document.getElementById("nestNavLinks");
    if (!burger || !links) return;
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Header search toggle */
  function initSearchToggle() {
    var toggle = document.getElementById("nestSearchToggle");
    var form = document.getElementById("nestSearchForm");
    if (!toggle || !form) return;
    toggle.addEventListener("click", function () {
      var open = form.classList.toggle("open");
      if (open) {
        form.querySelector("input").focus();
      }
    });
  }

  /* Favorite Picks category filters */
  function initCategoryTabs() {
    var tabs = document.querySelectorAll(".tab[data-filter]");
    var grid = document.getElementById("picksGrid");
    var empty = document.getElementById("filterEmpty");
    if (!tabs.length || !grid) return;

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        var filter = tab.getAttribute("data-filter");
        var visible = 0;
        grid.querySelectorAll(".product-card").forEach(function (card) {
          var cats = (card.getAttribute("data-category") || "").toLowerCase();
          var show = filter === "all" || cats.indexOf(filter) !== -1;
          card.style.display = show ? "" : "none";
          if (show) visible++;
        });
        if (empty) empty.classList.toggle("visible", visible === 0);
      });
    });
  }

  /* Rating stars derive fill from data-rating */
  function initStarRatings() {
    document.querySelectorAll(".product-card-rating").forEach(function (el) {
      var rating = parseFloat(el.getAttribute("data-rating"));
      var reviews = el.getAttribute("data-reviews") || "";
      var stars = el.querySelectorAll(".rstar");
      stars.forEach(function (star, i) {
        star.classList.toggle("filled", i < Math.round(rating));
      });
      var total = document.createElement("span");
      total.className = "total";
      total.textContent = "(" + reviews + ")";
      el.appendChild(total);
    });
  }

  /* Horizontally scrolling testimonials with dots */
  function initTestimonialCarousel() {
    var track = document.getElementById("testiTrack");
    var prev = document.getElementById("testiPrev");
    var next = document.getElementById("testiNext");
    var dots = document.getElementById("testiDots");
    if (!track) return;

    var cards = track.querySelectorAll(".testi-card");
    if (cards.length) {
      cards.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.className = "testi-dot";
        dot.type = "button";
        dot.setAttribute("aria-label", "Go to testimonial " + (i + 1));
        dot.addEventListener("click", function () {
          track.scrollTo({ left: i * (cards[0].offsetWidth + 20), behavior: "smooth" });
        });
        dots.appendChild(dot);
      });
    }

    var dotEls = dots ? dots.querySelectorAll(".testi-dot") : [];

    function step() {
      var card = Math.max(cards[0].offsetWidth, 300);
      return card + 20;
    }

    function goto(i) {
      track.scrollTo({
        left: i * step(),
        behavior: "smooth",
      });
    }

    if (prev) {
      prev.addEventListener("click", function () {
        track.scrollBy({ left: -step(), behavior: "smooth" });
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        track.scrollBy({ left: step(), behavior: "smooth" });
      });
    }

    var ticking = false;
    track.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var idx = Math.round(track.scrollLeft / step());
          idx = Math.max(0, Math.min(dotEls.length - 1, idx));
          dotEls.forEach(function (d, i) {
            d.classList.toggle("active", i === idx);
          });
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  /* Footer newsletter (demo onSubmit) */
  function initNewsletter() {
    var form = document.getElementById("newsletterForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type='email']");
      if (!input || !input.value) return;
      var msg = document.createElement("p");
      msg.style.cssText =
        "font-size:10px;color:#cfd1e2;margin:10px 0 0;";
      msg.textContent = "Thanks! You're on the list. (" + input.value + ")";
      form.parentNode.appendChild(msg);
      input.value = "";
      setTimeout(function () {
        msg.remove();
      }, 4000);
    });
  }
})();