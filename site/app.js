/* ============================================================
   rfc.akl.run - RFC Viewer
   Interactive behavior
   ============================================================ */

(function () {
  'use strict';

  // --- Theme ---
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('rfc-theme', theme);
  }

  function initTheme() {
    const saved = localStorage.getItem('rfc-theme');
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }

  themeToggle.addEventListener('click', function () {
    const current = root.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  });

  initTheme();

  // --- Sidebar ---
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  sidebarToggle.addEventListener('click', function () {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
    });
  });

  // --- Active section tracking ---
  const sections = document.querySelectorAll('.rfc-section, .subsection');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateActiveSection() {
    var scrollY = window.scrollY;
    var current = '';

    sections.forEach(function (section) {
      var top = section.offsetTop - 120;
      if (scrollY >= top) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === current) {
        link.classList.add('active');
      }
    });
  }

  // --- Section reveal on scroll ---
  function revealSections() {
    var triggerBottom = window.innerHeight * 0.88;

    sections.forEach(function (section) {
      var top = section.getBoundingClientRect().top;
      if (top < triggerBottom) {
        section.classList.add('visible');
      }
    });

    // Fade out scroll indicator
    var indicator = document.getElementById('scroll-indicator');
    if (indicator && window.scrollY > 100) {
      indicator.style.opacity = Math.max(0, 1 - window.scrollY / 400);
    }
  }

  // Throttled scroll handler
  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      window.requestAnimationFrame(function () {
        updateActiveSection();
        revealSections();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  // Initial reveal
  revealSections();
  updateActiveSection();

  // --- RARP animation (hero) ---
  var nodeIp = document.querySelector('.node-ip');
  function animateRarp() {
    if (!nodeIp) return;
    setInterval(function () {
      nodeIp.textContent = 'IP: ???.???.???.???';
      nodeIp.classList.remove('resolved');
      setTimeout(function () {
        nodeIp.textContent = 'IP: 192.0.2.1';
        nodeIp.classList.add('resolved');
      }, 1600);
    }, 3000);

    // Start the first cycle
    setTimeout(function () {
      nodeIp.textContent = 'IP: 192.0.2.1';
      nodeIp.classList.add('resolved');
    }, 1600);
  }
  animateRarp();

  // --- Search ---
  var searchInput = document.getElementById('search-input');
  var searchOverlay = document.getElementById('search-overlay');
  var searchResults = document.getElementById('search-results');

  // Build search index from page content
  function buildSearchIndex() {
    var index = [];
    document.querySelectorAll('.rfc-section, .subsection').forEach(function (section) {
      var id = section.getAttribute('id');
      if (!id) return;

      var heading = section.querySelector('h2, h3');
      var headingText = heading ? heading.textContent.trim() : id;

      // Get text content from the section
      var paragraphs = section.querySelectorAll('.section-body p, .section-body li, .callout-content, .field-detail, .opcode-desc, .reference-text');
      paragraphs.forEach(function (p) {
        var text = p.textContent.trim();
        if (text.length > 20) {
          index.push({
            id: id,
            section: headingText,
            text: text,
            element: p
          });
        }
      });
    });
    return index;
  }

  var searchIndex = buildSearchIndex();

  function performSearch(query) {
    if (!query || query.length < 2) {
      searchOverlay.classList.remove('active');
      searchResults.innerHTML = '';
      return;
    }

    var lowerQuery = query.toLowerCase();
    var results = searchIndex.filter(function (item) {
      return item.text.toLowerCase().indexOf(lowerQuery) !== -1;
    }).slice(0, 15);

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No results for "' + escapeHtml(query) + '"</div>';
      searchOverlay.classList.add('active');
      return;
    }

    var html = results.map(function (result) {
      var highlighted = highlightText(result.text, query);
      // Truncate to ~200 chars around the match
      var truncated = truncateAroundMatch(highlighted, query, 200);
      return '<div class="search-result-item" data-target="' + result.id + '">' +
        '<div class="search-result-section">' + escapeHtml(result.section) + '</div>' +
        '<div class="search-result-text">' + truncated + '</div>' +
        '</div>';
    }).join('');

    searchResults.innerHTML = html;
    searchOverlay.classList.add('active');

    // Click handlers for results
    searchResults.querySelectorAll('.search-result-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var target = item.getAttribute('data-target');
        var el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        searchOverlay.classList.remove('active');
        searchInput.value = '';
        searchInput.blur();
      });
    });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightText(text, query) {
    var escaped = escapeHtml(text);
    var regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function truncateAroundMatch(html, query, maxLen) {
    var plainText = html.replace(/<[^>]*>/g, '');
    if (plainText.length <= maxLen) return html;

    var lowerPlain = plainText.toLowerCase();
    var idx = lowerPlain.indexOf(query.toLowerCase());
    if (idx === -1) idx = 0;

    var start = Math.max(0, idx - Math.floor(maxLen / 2));
    var end = Math.min(plainText.length, start + maxLen);

    var prefix = start > 0 ? '...' : '';
    var suffix = end < plainText.length ? '...' : '';

    // Re-highlight on the truncated text
    var truncated = plainText.substring(start, end);
    var regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    truncated = escapeHtml(truncated).replace(regex, '<mark>$1</mark>');

    return prefix + truncated + suffix;
  }

  var searchDebounce;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function () {
      performSearch(searchInput.value.trim());
    }, 150);
  });

  searchInput.addEventListener('focus', function () {
    if (searchInput.value.trim().length >= 2) {
      performSearch(searchInput.value.trim());
    }
  });

  // Ctrl+K shortcut
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      searchOverlay.classList.remove('active');
      searchInput.blur();
    }
  });

  // Close search on overlay click
  searchOverlay.addEventListener('click', function (e) {
    if (e.target === searchOverlay) {
      searchOverlay.classList.remove('active');
      searchInput.value = '';
    }
  });

  // --- Background canvas: network packet visualization ---
  var canvas = document.getElementById('bg-canvas');
  var ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Particles representing network packets
  var particles = [];
  var maxParticles = 50;

  function Particle() {
    this.reset();
  }

  Particle.prototype.reset = function () {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 1.5 + 0.5;
    this.opacity = Math.random() * 0.5 + 0.1;
  };

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  };

  Particle.prototype.draw = function () {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 211, 238, ' + this.opacity + ')';
    ctx.fill();
  };

  // Initialize particles
  for (var i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }

  var connectionDistance = 150;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & draw particles
    particles.forEach(function (p) {
      p.update();
      p.draw();
    });

    // Draw connections
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDistance) {
          var opacity = (1 - dist / connectionDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(34, 211, 238, ' + opacity + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  // Only animate when tab is visible
  var animationId;
  function startAnimation() {
    if (!animationId) {
      animationId = requestAnimationFrame(function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(function (p) {
          p.update();
          p.draw();
        });
        for (var i = 0; i < particles.length; i++) {
          for (var j = i + 1; j < particles.length; j++) {
            var dx = particles[i].x - particles[j].x;
            var dy = particles[i].y - particles[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < connectionDistance) {
              var opacity = (1 - dist / connectionDistance) * 0.15;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = 'rgba(34, 211, 238, ' + opacity + ')';
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
        animationId = requestAnimationFrame(loop);
      });
    }
  }

  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  // Reduce particles on mobile
  if (window.innerWidth < 768) {
    maxParticles = 20;
    particles.splice(20);
    connectionDistance = 100;
  }

  startAnimation();

})();
