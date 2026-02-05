/* ============================================================
   rfc.akl.run - RFC Viewer SPA
   Single-page application for browsing and reading RFCs.
   Reads from window.RFC_DATA, uses hash-based routing.
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // Constants
  // ============================================================

  var DEFAULT_RFC = null; // null = show landing page

  var CATEGORY_ORDER = [
    'core', 'dns', 'http', 'transport', 'security',
    'email', 'routing', 'applications', 'infrastructure', 'data', 'meta'
  ];

  var CATEGORY_NAMES = {
    core: 'Core Protocols',
    dns: 'DNS',
    http: 'HTTP & Web',
    security: 'Security',
    email: 'Email',
    routing: 'Routing',
    applications: 'Applications',
    infrastructure: 'Infrastructure',
    data: 'Data & Encoding',
    transport: 'Transport',
    meta: 'Meta & Culture'
  };

  var STATUS_CLASS_MAP = {
    'Internet Standard': 'standard',
    'Proposed Standard': 'proposed',
    'Historic': 'historic',
    'Informational': 'informational',
    'Experimental': 'experimental',
    'Best Current Practice': 'bcp'
  };

  // ============================================================
  // Application State
  // ============================================================

  var rfcData = [];
  var rfcMap = {};
  var currentRFC = null;
  var searchIndex = [];
  var sectionObserver = null;
  var scrollTicking = false;
  var searchDebounceTimer = null;

  // ============================================================
  // DOM References
  // ============================================================

  var contentEl = document.getElementById('content');
  var sidebarInner = document.getElementById('sidebar-inner');
  var sidebar = document.getElementById('sidebar');
  var sidebarToggle = document.getElementById('sidebar-toggle');
  var sidebarOverlay = document.getElementById('sidebar-overlay');
  var searchInput = document.getElementById('search-input');
  var searchOverlay = document.getElementById('search-overlay');
  var searchResults = document.getElementById('search-results');
  var ietfLink = document.getElementById('ietf-link');
  var bgCanvas = document.getElementById('bg-canvas');

  // ============================================================
  // Utility Functions
  // ============================================================

  function escapeHtml(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripHtml(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function getStatusClass(status) {
    if (!status) return 'informational';
    return STATUS_CLASS_MAP[status] || 'informational';
  }

  // ============================================================
  // Theme (dark mode only)
  // ============================================================

  function initTheme() {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // ============================================================
  // Mobile Sidebar
  // ============================================================

  function openSidebar() {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupMobileSidebar() {
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function () {
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking any navigation link on mobile
    if (sidebarInner) {
      sidebarInner.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (link && window.innerWidth <= 1024) {
          closeSidebar();
        }
      });
    }
  }

  // ============================================================
  // Background Canvas - Particle Network Animation
  // ============================================================

  function setupCanvas() {
    if (!bgCanvas) return;

    var ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    var particles = [];
    var maxParticles = window.innerWidth < 768 ? 20 : 50;
    var connectionDistance = window.innerWidth < 768 ? 100 : 150;
    var animationId = null;

    function resizeCanvas() {
      bgCanvas.width = window.innerWidth;
      bgCanvas.height = window.innerHeight;
    }

    function Particle() {
      this.x = Math.random() * bgCanvas.width;
      this.y = Math.random() * bgCanvas.height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.radius = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.5 + 0.1;
    }

    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > bgCanvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > bgCanvas.height) this.vy *= -1;
    };

    Particle.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, ' + this.opacity + ')';
      ctx.fill();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (var p = 0; p < maxParticles; p++) {
      particles.push(new Particle());
    }

    function drawFrame() {
      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

      var i, j, dx, dy, dist, opacity;

      for (i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      for (i = 0; i < particles.length; i++) {
        for (j = i + 1; j < particles.length; j++) {
          dx = particles[i].x - particles[j].x;
          dy = particles[i].y - particles[j].y;
          dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            opacity = (1 - dist / connectionDistance) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(34, 211, 238, ' + opacity + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(drawFrame);
    }

    function startAnimation() {
      if (!animationId) {
        animationId = requestAnimationFrame(drawFrame);
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

    startAnimation();
  }

  // ============================================================
  // Sidebar: Population
  // ============================================================

  function populateSidebar() {
    if (!sidebarInner) return;

    var html = '';

    // RFC Info Header placeholder (updated on navigation)
    html += '<div class="sidebar-rfc-header" id="sidebar-rfc-header"></div>';

    // TOC placeholder (updated on navigation)
    html += '<div class="sidebar-toc" id="sidebar-toc"></div>';

    // Divider between TOC and RFC browser
    html += '<div class="sidebar-divider"></div>';

    // RFC Browser: all RFCs grouped by category
    html += '<div class="sidebar-rfc-list">';
    html += '<div class="rfc-list-title">All RFCs</div>';

    // Group RFCs by category
    var categoryBuckets = {};
    rfcData.forEach(function (rfc) {
      var cat = rfc.category || 'meta';
      if (!categoryBuckets[cat]) categoryBuckets[cat] = [];
      categoryBuckets[cat].push(rfc);
    });

    // Render each category in the defined order
    CATEGORY_ORDER.forEach(function (catKey) {
      var rfcsInCat = categoryBuckets[catKey];
      if (!rfcsInCat || rfcsInCat.length === 0) return;

      var expanded = getCategoryExpanded(catKey);

      html += '<div class="sidebar-category" data-category="' + catKey + '">';
      html += '<div class="sidebar-category-title" data-expanded="' + (expanded ? 'true' : 'false') + '">';
      html += '<span class="cat-arrow">' + (expanded ? '&#9660;' : '&#9654;') + '</span> ';
      html += escapeHtml(CATEGORY_NAMES[catKey] || catKey);
      html += '<span class="cat-count">' + rfcsInCat.length + '</span>';
      html += '</div>';
      html += '<div class="sidebar-category-items"' + (expanded ? '' : ' style="display:none"') + '>';

      rfcsInCat.forEach(function (rfc) {
        var classes = 'sidebar-rfc-item';
        if (rfc.featured) classes += ' featured';
        html += '<a href="#rfc' + rfc.number + '" class="' + classes + '">';
        html += '<span class="rfc-num">' + rfc.number + '</span>';
        html += '<span class="rfc-short">' + escapeHtml(rfc.shortTitle || rfc.title) + '</span>';
        html += '</a>';
      });

      html += '</div>'; // sidebar-category-items
      html += '</div>'; // sidebar-category
    });

    html += '</div>'; // sidebar-rfc-list

    // Authors footer placeholder (updated on navigation)
    html += '<div class="sidebar-footer" id="sidebar-footer"></div>';

    sidebarInner.innerHTML = html;

    // Attach category expand/collapse handlers
    setupCategoryToggles();
  }

  // ============================================================
  // Sidebar: Category Expand/Collapse
  // ============================================================

  function getCategoryExpanded(catKey) {
    try {
      var stored = sessionStorage.getItem('rfc-cat-' + catKey);
      if (stored !== null) return stored === 'true';
    } catch (e) { /* storage unavailable */ }
    // Default: expand 'core', collapse everything else
    return catKey === 'core';
  }

  function setCategoryExpanded(catKey, expanded) {
    try {
      sessionStorage.setItem('rfc-cat-' + catKey, expanded ? 'true' : 'false');
    } catch (e) { /* storage unavailable */ }
  }

  function setupCategoryToggles() {
    if (!sidebarInner) return;

    var titles = sidebarInner.querySelectorAll('.sidebar-category-title');
    for (var i = 0; i < titles.length; i++) {
      (function (title) {
        title.addEventListener('click', function () {
          var isExpanded = title.getAttribute('data-expanded') === 'true';
          var newState = !isExpanded;

          title.setAttribute('data-expanded', newState ? 'true' : 'false');

          var arrow = title.querySelector('.cat-arrow');
          if (arrow) {
            arrow.innerHTML = newState ? '&#9660;' : '&#9654;';
          }

          var items = title.nextElementSibling;
          if (items) {
            items.style.display = newState ? '' : 'none';
          }

          var catEl = title.parentElement;
          var catKey = catEl ? catEl.getAttribute('data-category') : null;
          if (catKey) setCategoryExpanded(catKey, newState);
        });
      })(titles[i]);
    }
  }

  // ============================================================
  // Sidebar: Update RFC Header
  // ============================================================

  function updateSidebarHeader(rfc) {
    var el = document.getElementById('sidebar-rfc-header');
    if (!el || !rfc) return;

    var html = '';
    html += '<div class="rfc-badge">RFC ' + rfc.number + '</div>';
    html += '<div class="rfc-status">Status: ' + escapeHtml(rfc.status || 'Unknown') + '</div>';
    html += '<div class="sidebar-meta">';
    html += '<div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">' + escapeHtml(rfc.date || 'Unknown') + '</span></div>';

    if (rfc.organization) {
      html += '<div class="meta-item"><span class="meta-label">Org</span><span class="meta-value">' + escapeHtml(rfc.organization) + '</span></div>';
    }

    if (rfc.obsoletedBy) {
      html += '<div class="meta-item"><span class="meta-label">Obsoleted By</span><span class="meta-value">' + escapeHtml(rfc.obsoletedBy) + '</span></div>';
    }

    if (rfc.obsoletes) {
      html += '<div class="meta-item"><span class="meta-label">Obsoletes</span><span class="meta-value">' + escapeHtml(rfc.obsoletes) + '</span></div>';
    }

    html += '</div>'; // sidebar-meta
    el.innerHTML = html;
  }

  // ============================================================
  // Sidebar: Update TOC
  // ============================================================

  function updateSidebarTOC(rfc) {
    var tocEl = document.getElementById('sidebar-toc');
    if (!tocEl) return;

    // Hide TOC for non-featured or section-less RFCs
    if (!rfc || !rfc.featured || !rfc.sections || rfc.sections.length === 0) {
      tocEl.innerHTML = '';
      tocEl.style.display = 'none';
      return;
    }

    tocEl.style.display = '';

    var html = '<div class="toc-title">Contents</div>';

    for (var i = 0; i < rfc.sections.length; i++) {
      var s = rfc.sections[i];
      html += '<a href="#' + s.id + '" class="toc-link" data-section="' + s.id + '">';
      html += s.number + '. ' + escapeHtml(s.title);
      html += '</a>';
    }

    // References link
    if (rfc.references && rfc.references.length > 0) {
      var refNum = rfc.sections.length + 1;
      html += '<a href="#references" class="toc-link" data-section="references">';
      html += refNum + '. References';
      html += '</a>';
    }

    tocEl.innerHTML = html;

    // Attach smooth-scroll handlers to TOC links
    var links = tocEl.querySelectorAll('.toc-link');
    for (var j = 0; j < links.length; j++) {
      (function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var targetId = link.getAttribute('data-section');
          var targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          if (window.innerWidth <= 1024) {
            closeSidebar();
          }
        });
      })(links[j]);
    }
  }

  // ============================================================
  // Sidebar: Update Footer (Authors)
  // ============================================================

  function updateSidebarFooter(rfc) {
    var footerEl = document.getElementById('sidebar-footer');
    if (!footerEl || !rfc) return;

    var html = '<div class="sidebar-authors-title">Authors</div>';

    if (rfc.authors && rfc.authors.length > 0) {
      for (var i = 0; i < rfc.authors.length; i++) {
        html += '<div class="sidebar-author">' + escapeHtml(rfc.authors[i]) + '</div>';
      }
    }

    if (rfc.organization) {
      html += '<div class="sidebar-author-org">' + escapeHtml(rfc.organization) + '</div>';
    }

    footerEl.innerHTML = html;
  }

  // ============================================================
  // Sidebar: Update Active Highlight
  // ============================================================

  function updateSidebarActive(rfcNumber) {
    if (!sidebarInner) return;

    var items = sidebarInner.querySelectorAll('.sidebar-rfc-item');
    var targetHref = '#rfc' + rfcNumber;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item.getAttribute('href') === targetHref) {
        item.classList.add('active');

        // Ensure the parent category is expanded so the active item is visible
        var category = item.closest('.sidebar-category');
        if (category) {
          var title = category.querySelector('.sidebar-category-title');
          if (title && title.getAttribute('data-expanded') !== 'true') {
            title.click();
          }
        }
      } else {
        item.classList.remove('active');
      }
    }
  }

  // ============================================================
  // Routing
  // ============================================================

  function parseHash() {
    var hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#home') return null; // landing page

    var match = hash.match(/^#rfc(\d+)$/i);
    if (match) return parseInt(match[1], 10);

    return null; // unknown hash -> landing page
  }

  function navigateTo(rfcNumber) {
    // Landing page
    if (rfcNumber === null) {
      currentRFC = null;
      renderLandingPage();
      clearSidebarPanels();
      updateSidebarActive(null);
      document.title = 'rfc.akl.run - RFC Viewer';
      if (ietfLink) ietfLink.href = 'https://www.ietf.org/standards/rfcs/';
      window.scrollTo(0, 0);
      setupScrollReveal();
      return;
    }

    var rfc = rfcMap[rfcNumber];

    if (!rfc) {
      renderNotFound(rfcNumber);
      document.title = 'RFC ' + rfcNumber + ' - Not Found | rfc.akl.run';
      return;
    }

    currentRFC = rfc;

    // Render page content
    if (rfc.featured) {
      renderFeaturedRFC(rfc);
    } else {
      renderBasicRFC(rfc);
    }

    // Update all sidebar panels
    updateSidebarHeader(rfc);
    updateSidebarTOC(rfc);
    updateSidebarFooter(rfc);
    updateSidebarActive(rfcNumber);

    // Update document title
    document.title = 'RFC ' + rfc.number + ': ' + rfc.title + ' | rfc.akl.run';

    // Update IETF external link in topbar
    if (ietfLink) {
      ietfLink.href = 'https://datatracker.ietf.org/doc/html/rfc' + rfc.number;
    }

    // Scroll to top of page
    window.scrollTo(0, 0);

    // Re-initialize scroll-reveal and active section tracking
    setupScrollReveal();
    updateActiveSection();
  }

  function setupRouting() {
    window.addEventListener('hashchange', function () {
      navigateTo(parseHash());
    });
  }

  // ============================================================
  // Rendering: Featured RFC
  // ============================================================

  function renderFeaturedRFC(rfc) {
    var heroColor = (rfc.hero && rfc.hero.color) ? rfc.hero.color : 'cyan';
    var statusClass = getStatusClass(rfc.status);
    var html = '';

    html += '<article class="rfc-document">';

    // --- Hero Section ---
    html += '<section id="hero" class="rfc-section rfc-hero hero-color-' + heroColor + '">';
    html += '<div class="hero-grid">';

    // Hero text column
    html += '<div class="hero-text">';

    html += '<div class="hero-badge-row">';
    html += '<span class="hero-badge">RFC ' + rfc.number + '</span>';
    html += '<span class="hero-badge hero-badge-status status-' + statusClass + '">' + escapeHtml(rfc.status) + '</span>';
    html += '</div>';

    html += '<h1 class="hero-title">' + escapeHtml(rfc.title) + '</h1>';

    if (rfc.hero && rfc.hero.subtitle) {
      html += '<p class="hero-subtitle">' + escapeHtml(rfc.hero.subtitle) + '</p>';
    }

    html += '<div class="hero-meta">';
    html += renderHeroMetaItem('Published', rfc.date);

    if (rfc.authors && rfc.authors.length > 0) {
      html += renderHeroMetaItem('Authors', rfc.authors.join(', '));
    }

    if (rfc.organization) {
      html += renderHeroMetaItem('Organization', rfc.organization);
    }

    html += '</div>'; // hero-meta
    html += '</div>'; // hero-text

    // Hero visual column
    html += '<div class="hero-visual">';
    if (rfc.hero && rfc.hero.animation) {
      html += renderAnimation(rfc.hero.animation, rfc.hero.animationData || {}, heroColor);
    }
    html += '</div>';

    html += '</div>'; // hero-grid

    // Scroll indicator
    html += '<div class="scroll-indicator" id="scroll-indicator">';
    html += '<span>Scroll to explore</span>';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">';
    html += '<path d="M12 5v14M5 12l7 7 7-7"/>';
    html += '</svg>';
    html += '</div>';

    html += '</section>'; // hero

    // --- Content Sections ---
    if (rfc.sections && rfc.sections.length > 0) {
      for (var i = 0; i < rfc.sections.length; i++) {
        html += renderSection(rfc.sections[i]);
      }
    }

    // --- References Section ---
    if (rfc.references && rfc.references.length > 0) {
      var refSectionNum = (rfc.sections ? rfc.sections.length : 0) + 1;

      html += '<section id="references" class="rfc-section">';
      html += '<h2 class="section-heading">';
      html += '<span class="section-number">' + refSectionNum + '.</span> References';
      html += '</h2>';
      html += '<div class="section-body">';
      html += '<div class="reference-list">';

      for (var r = 0; r < rfc.references.length; r++) {
        html += renderReference(rfc.references[r]);
      }

      html += '</div>'; // reference-list
      html += '</div>'; // section-body
      html += '</section>';
    }

    // --- Footer ---
    html += renderDocFooter(rfc);

    html += '</article>';

    contentEl.innerHTML = html;
  }

  // ============================================================
  // Rendering: Basic (Non-Featured) RFC
  // ============================================================

  function renderBasicRFC(rfc) {
    var statusClass = getStatusClass(rfc.status);
    var html = '';

    html += '<article class="rfc-document">';
    html += '<section class="rfc-section rfc-hero rfc-hero-basic">';

    html += '<div class="hero-badge-row">';
    html += '<span class="hero-badge">RFC ' + rfc.number + '</span>';
    html += '<span class="hero-badge hero-badge-status status-' + statusClass + '">' + escapeHtml(rfc.status) + '</span>';
    html += '</div>';

    html += '<h1 class="hero-title">' + escapeHtml(rfc.title) + '</h1>';

    html += '<div class="hero-meta">';
    html += renderHeroMetaItem('Published', rfc.date);

    if (rfc.authors && rfc.authors.length > 0) {
      html += renderHeroMetaItem('Authors', rfc.authors.join(', '));
    }

    if (rfc.organization) {
      html += renderHeroMetaItem('Organization', rfc.organization);
    }

    if (rfc.obsoletedBy) {
      html += renderHeroMetaItem('Obsoleted By', rfc.obsoletedBy);
    }

    if (rfc.obsoletes) {
      html += renderHeroMetaItem('Obsoletes', rfc.obsoletes);
    }

    html += '</div>'; // hero-meta

    html += '<div class="basic-rfc-actions">';
    html += '<a href="https://datatracker.ietf.org/doc/html/rfc' + rfc.number + '" target="_blank" rel="noopener" class="btn-primary">';
    html += 'Read Full RFC on IETF';
    html += '</a>';
    html += '</div>';

    html += '</section>';
    html += '</article>';

    contentEl.innerHTML = html;
  }

  // ============================================================
  // Rendering: Not Found
  // ============================================================

  function renderNotFound(rfcNumber) {
    var html = '';

    html += '<article class="rfc-document">';
    html += '<section class="rfc-section rfc-hero rfc-hero-basic visible">';

    html += '<div class="hero-badge-row">';
    html += '<span class="hero-badge">RFC ' + rfcNumber + '</span>';
    html += '</div>';

    html += '<h1 class="hero-title">RFC Not Found</h1>';
    html += '<p class="hero-subtitle">RFC ' + escapeHtml(String(rfcNumber));
    html += ' is not available in this viewer. You can try viewing it on the IETF website.</p>';

    html += '<div class="basic-rfc-actions">';
    html += '<a href="https://datatracker.ietf.org/doc/html/rfc' + rfcNumber + '" target="_blank" rel="noopener" class="btn-primary">';
    html += 'View on IETF';
    html += '</a>';
    html += '</div>';

    html += '</section>';
    html += '</article>';

    contentEl.innerHTML = html;
  }

  // ============================================================
  // Rendering: Helpers
  // ============================================================

  function renderHeroMetaItem(label, value) {
    if (!value) return '';
    var html = '<div class="hero-meta-item">';
    html += '<span class="hero-meta-label">' + escapeHtml(label) + '</span>';
    html += '<span class="hero-meta-value">' + escapeHtml(value) + '</span>';
    html += '</div>';
    return html;
  }

  function renderSection(section) {
    if (!section) return '';
    var html = '<section id="' + section.id + '" class="rfc-section">';
    html += '<h2 class="section-heading">';
    html += '<span class="section-number">' + escapeHtml(section.number) + '.</span> ';
    html += escapeHtml(section.title);
    html += '</h2>';
    // section.content is trusted raw HTML from data files
    html += '<div class="section-body">' + (section.content || '') + '</div>';
    html += '</section>';
    return html;
  }

  function renderReference(ref) {
    if (!ref) return '';
    var html = '<div class="reference-item">';
    html += '<span class="reference-number">' + escapeHtml(ref.number) + '</span>';
    html += '<span class="reference-text">' + escapeHtml(ref.text) + '</span>';
    html += '</div>';
    return html;
  }

  function renderDocFooter(rfc) {
    var html = '<footer class="rfc-footer">';
    html += '<div class="footer-content">';
    html += '<span>RFC ' + rfc.number + ' &mdash; ' + escapeHtml(rfc.title) + '</span>';
    html += '<a href="https://datatracker.ietf.org/doc/html/rfc' + rfc.number + '" target="_blank" rel="noopener">View original on IETF</a>';
    html += '</div>';
    html += '</footer>';
    return html;
  }

  // ============================================================
  // Rendering: Landing Page
  // ============================================================

  function clearSidebarPanels() {
    var headerEl = document.getElementById('sidebar-rfc-header');
    if (headerEl) headerEl.innerHTML = '';
    var tocEl = document.getElementById('sidebar-toc');
    if (tocEl) { tocEl.innerHTML = ''; tocEl.style.display = 'none'; }
    var footerEl = document.getElementById('sidebar-footer');
    if (footerEl) footerEl.innerHTML = '';
  }

  function renderLandingPage() {
    var html = '';
    html += '<div class="landing-page">';

    // Hero area
    html += '<section class="landing-hero visible">';
    html += '<h1 class="landing-title">Requests for Comments</h1>';
    html += '<p class="landing-subtitle">Exploring the documents that built the Internet</p>';
    html += '</section>';

    // Featured RFCs grid
    var featured = rfcData.filter(function (r) { return r.featured; });

    // Group featured by category, render each category
    var categoryBuckets = {};
    featured.forEach(function (rfc) {
      var cat = rfc.category || 'meta';
      if (!categoryBuckets[cat]) categoryBuckets[cat] = [];
      categoryBuckets[cat].push(rfc);
    });

    CATEGORY_ORDER.forEach(function (catKey) {
      var rfcsInCat = categoryBuckets[catKey];
      if (!rfcsInCat || rfcsInCat.length === 0) return;

      html += '<section class="landing-category rfc-section">';
      html += '<h2 class="landing-category-title">' + escapeHtml(CATEGORY_NAMES[catKey] || catKey) + '</h2>';
      html += '<div class="landing-grid">';

      rfcsInCat.forEach(function (rfc) {
        var heroColor = (rfc.hero && rfc.hero.color) ? rfc.hero.color : 'cyan';
        var statusClass = getStatusClass(rfc.status);
        html += '<a href="#rfc' + rfc.number + '" class="landing-card hero-color-' + heroColor + '">';
        html += '<div class="landing-card-number">RFC ' + rfc.number + '</div>';
        html += '<div class="landing-card-title">' + escapeHtml(rfc.shortTitle || rfc.title) + '</div>';
        html += '<div class="landing-card-desc">' + escapeHtml(rfc.title) + '</div>';
        html += '<div class="landing-card-meta">';
        html += '<span class="landing-card-status status-' + statusClass + '">' + escapeHtml(rfc.status) + '</span>';
        html += '<span class="landing-card-date">' + escapeHtml(rfc.date) + '</span>';
        html += '</div>';
        html += '</a>';
      });

      html += '</div>'; // landing-grid
      html += '</section>';
    });

    // All RFCs section
    var basic = rfcData.filter(function (r) { return !r.featured; });
    if (basic.length > 0) {
      html += '<section class="landing-category rfc-section">';
      html += '<h2 class="landing-category-title">All Other RFCs</h2>';
      html += '<div class="landing-list">';

      basic.forEach(function (rfc) {
        html += '<a href="#rfc' + rfc.number + '" class="landing-list-item">';
        html += '<span class="landing-list-num">RFC ' + rfc.number + '</span>';
        html += '<span class="landing-list-name">' + escapeHtml(rfc.shortTitle || rfc.title) + '</span>';
        html += '<span class="landing-list-date">' + escapeHtml(rfc.date) + '</span>';
        html += '</a>';
      });

      html += '</div>';
      html += '</section>';
    }

    html += '</div>'; // landing-page
    contentEl.innerHTML = html;
  }

  // ============================================================
  // Rendering: Hero Animations
  // ============================================================

  function renderAnimation(type, data, color) {
    if (!data) data = {};

    switch (type) {
      case 'packet-flow':
        return renderAnimPacketFlow(data, color);
      case 'handshake':
        return renderAnimHandshake(data, color);
      case 'layers':
        return renderAnimLayers(data, color);
      case 'tree':
        return renderAnimTree(data, color);
      case 'lock':
        return renderAnimLock(data, color);
      case 'request-response':
        return renderAnimRequestResponse(data, color);
      case 'data-format':
        return renderAnimDataFormat(data, color);
      default:
        return renderAnimFallback(data, color);
    }
  }

  // --- packet-flow ---
  function renderAnimPacketFlow(data, color) {
    var top = data.topNode || {};
    var bottom = data.bottomNode || {};
    var html = '';

    html += '<div class="hero-anim hero-anim-packet-flow">';

    // Top node
    html += '<div class="anim-node anim-node-top">';
    if (top.icon) html += '<div class="anim-node-icon">' + top.icon + '</div>';
    if (top.label) html += '<div class="anim-node-label">' + escapeHtml(top.label) + '</div>';
    if (top.detail) html += '<div class="anim-node-detail">' + escapeHtml(top.detail) + '</div>';
    if (top.extra) html += '<div class="anim-node-extra">' + escapeHtml(top.extra) + '</div>';
    html += '</div>';

    // Wire with traveling dot
    html += '<div class="anim-wire">';
    html += '<div class="anim-dot"></div>';
    if (data.reqLabel) {
      html += '<div class="anim-wire-label anim-wire-req">' + escapeHtml(data.reqLabel) + '</div>';
    }
    if (data.repLabel) {
      html += '<div class="anim-wire-label anim-wire-rep">' + escapeHtml(data.repLabel) + '</div>';
    }
    html += '</div>';

    // Bottom node
    html += '<div class="anim-node anim-node-bottom">';
    if (bottom.icon) html += '<div class="anim-node-icon">' + bottom.icon + '</div>';
    if (bottom.label) html += '<div class="anim-node-label">' + escapeHtml(bottom.label) + '</div>';
    if (bottom.detail) html += '<div class="anim-node-detail">' + escapeHtml(bottom.detail) + '</div>';
    if (bottom.extra) html += '<div class="anim-node-extra">' + escapeHtml(bottom.extra) + '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- handshake ---
  function renderAnimHandshake(data, color) {
    var steps = data.steps || [];
    var leftLabel = data.leftLabel || 'Client';
    var rightLabel = data.rightLabel || 'Server';
    var html = '';

    html += '<div class="hero-anim hero-anim-handshake">';

    html += '<div class="anim-hs-sides">';
    html += '<div class="anim-hs-side">' + escapeHtml(leftLabel) + '</div>';
    html += '<div class="anim-hs-side">' + escapeHtml(rightLabel) + '</div>';
    html += '</div>';

    html += '<div class="anim-hs-steps">';
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var from = step.from || 'left';
      html += '<div class="anim-hs-step anim-hs-from-' + from + '" style="animation-delay: ' + (i * 0.5) + 's">';
      html += '<div class="anim-hs-arrow"></div>';
      html += '<div class="anim-hs-label">' + escapeHtml(step.label || '') + '</div>';
      if (step.description) {
        html += '<div class="anim-hs-desc">' + escapeHtml(step.description) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- layers ---
  function renderAnimLayers(data, color) {
    var layers = data.layers || [];
    var html = '';

    html += '<div class="hero-anim hero-anim-layers">';

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var cls = 'anim-layer';
      if (layer.highlight) cls += ' anim-layer-highlight';

      html += '<div class="' + cls + '" style="animation-delay: ' + (i * 0.15) + 's">';
      html += '<div class="anim-layer-name">' + escapeHtml(layer.name || '') + '</div>';
      html += '<div class="anim-layer-detail">' + escapeHtml(layer.detail || '') + '</div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // --- tree ---
  function renderAnimTree(data, color) {
    var root = data.root || { label: '.', children: [] };
    var html = '';

    html += '<div class="hero-anim hero-anim-tree">';
    html += renderTreeNode(root, 0);
    html += '</div>';
    return html;
  }

  function renderTreeNode(node, depth) {
    if (!node) return '';
    var html = '';

    html += '<div class="anim-tree-node" style="margin-left: ' + (depth * 24) + 'px">';
    html += '<div class="anim-tree-label">' + escapeHtml(node.label || '') + '</div>';

    if (node.children && node.children.length > 0) {
      html += '<div class="anim-tree-children">';
      for (var i = 0; i < node.children.length; i++) {
        html += renderTreeNode(node.children[i], depth + 1);
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // --- lock ---
  function renderAnimLock(data, color) {
    var steps = data.steps || [];
    var html = '';

    html += '<div class="hero-anim hero-anim-lock">';

    html += '<div class="anim-lock-icon">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">';
    html += '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>';
    html += '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
    html += '</svg>';
    html += '</div>';

    html += '<div class="anim-lock-steps">';
    for (var i = 0; i < steps.length; i++) {
      html += '<div class="anim-lock-step" style="animation-delay: ' + (i * 0.6) + 's">';
      html += escapeHtml(steps[i]);
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- request-response ---
  function renderAnimRequestResponse(data, color) {
    var request = data.request || {};
    var response = data.response || {};
    var html = '';

    html += '<div class="hero-anim hero-anim-request-response">';

    // Request block
    html += '<div class="anim-rr-block anim-rr-request">';
    html += '<div class="anim-rr-title">Request</div>';
    html += '<div class="anim-rr-line anim-rr-method">';
    html += escapeHtml((request.method || 'GET') + ' ' + (request.path || '/'));
    html += '</div>';
    if (request.headers && request.headers.length > 0) {
      for (var i = 0; i < request.headers.length; i++) {
        html += '<div class="anim-rr-line anim-rr-header">' + escapeHtml(request.headers[i]) + '</div>';
      }
    }
    html += '</div>';

    // Connecting arrow
    html += '<div class="anim-rr-arrow">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">';
    html += '<path d="M12 5v14M5 12l7 7 7-7"/>';
    html += '</svg>';
    html += '</div>';

    // Response block
    html += '<div class="anim-rr-block anim-rr-response">';
    html += '<div class="anim-rr-title">Response</div>';
    html += '<div class="anim-rr-line anim-rr-status">' + escapeHtml(response.status || '200 OK') + '</div>';
    if (response.headers && response.headers.length > 0) {
      for (var j = 0; j < response.headers.length; j++) {
        html += '<div class="anim-rr-line anim-rr-header">' + escapeHtml(response.headers[j]) + '</div>';
      }
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- data-format ---
  function renderAnimDataFormat(data, color) {
    var lines = data.lines || [];
    var html = '';

    html += '<div class="hero-anim hero-anim-data-format">';
    html += '<div class="anim-df-block">';

    for (var i = 0; i < lines.length; i++) {
      html += '<div class="anim-df-line" style="animation-delay: ' + (i * 0.1) + 's">';
      html += escapeHtml(lines[i]);
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';
    return html;
  }

  // --- fallback ---
  function renderAnimFallback(data, color) {
    var html = '';

    html += '<div class="hero-anim hero-anim-fallback">';
    html += '<div class="anim-fallback-badge">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">';
    html += '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>';
    html += '<polyline points="14 2 14 8 20 8"/>';
    html += '<line x1="16" y1="13" x2="8" y2="13"/>';
    html += '<line x1="16" y1="17" x2="8" y2="17"/>';
    html += '<polyline points="10 9 9 9 8 9"/>';
    html += '</svg>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ============================================================
  // Scroll-Reveal (IntersectionObserver)
  // ============================================================

  function setupScrollReveal() {
    // Disconnect any previous observer
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }

    if (!contentEl) return;

    var sections = contentEl.querySelectorAll('.rfc-section');
    if (sections.length === 0) return;

    // Use IntersectionObserver if available, otherwise make all visible
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < sections.length; i++) {
        sections[i].classList.add('visible');
      }
      return;
    }

    sectionObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('visible');
        }
      }
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -10% 0px'
    });

    for (var j = 0; j < sections.length; j++) {
      sectionObserver.observe(sections[j]);
    }
  }

  // ============================================================
  // Active Section Tracking in TOC
  // ============================================================

  function updateActiveSection() {
    if (!contentEl) return;

    var sections = contentEl.querySelectorAll('.rfc-section[id]');
    var tocLinks = document.querySelectorAll('#sidebar-toc .toc-link');
    if (tocLinks.length === 0) return;

    var scrollY = window.scrollY || window.pageYOffset;
    var currentId = '';

    for (var i = 0; i < sections.length; i++) {
      var sectionTop = sections[i].offsetTop - 140;
      if (scrollY >= sectionTop) {
        currentId = sections[i].getAttribute('id');
      }
    }

    for (var j = 0; j < tocLinks.length; j++) {
      if (tocLinks[j].getAttribute('data-section') === currentId) {
        tocLinks[j].classList.add('active');
      } else {
        tocLinks[j].classList.remove('active');
      }
    }

    // Fade scroll indicator as user scrolls down
    var indicator = document.getElementById('scroll-indicator');
    if (indicator && scrollY > 100) {
      indicator.style.opacity = String(Math.max(0, 1 - scrollY / 400));
    }
  }

  function onScroll() {
    if (!scrollTicking) {
      window.requestAnimationFrame(function () {
        updateActiveSection();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  // ============================================================
  // Search
  // ============================================================

  function buildSearchIndex() {
    searchIndex = [];

    for (var i = 0; i < rfcData.length; i++) {
      var rfc = rfcData[i];

      // Index the RFC title and short title
      searchIndex.push({
        type: 'rfc',
        rfcNumber: rfc.number,
        rfcTitle: rfc.title,
        shortTitle: rfc.shortTitle || '',
        text: (rfc.title + ' ' + (rfc.shortTitle || '')).trim(),
        sectionId: null,
        sectionTitle: null
      });

      // Index section content for featured RFCs
      if (rfc.featured && rfc.sections && rfc.sections.length > 0) {
        for (var j = 0; j < rfc.sections.length; j++) {
          var section = rfc.sections[j];
          var plainContent = stripHtml(section.content);
          if (plainContent.length > 10) {
            searchIndex.push({
              type: 'section',
              rfcNumber: rfc.number,
              rfcTitle: rfc.title,
              shortTitle: rfc.shortTitle || '',
              text: plainContent,
              sectionId: section.id,
              sectionTitle: section.number + '. ' + section.title
            });
          }
        }
      }
    }
  }

  function performSearch(query) {
    if (!query || query.length < 2) {
      searchOverlay.classList.remove('active');
      searchResults.innerHTML = '';
      return;
    }

    var lowerQuery = query.toLowerCase();

    var rfcMatches = [];
    var sectionMatches = [];

    for (var i = 0; i < searchIndex.length; i++) {
      var item = searchIndex[i];
      if (item.text.toLowerCase().indexOf(lowerQuery) === -1) continue;

      if (item.type === 'rfc') {
        rfcMatches.push(item);
      } else {
        sectionMatches.push(item);
      }
    }

    // Cap results to avoid flooding
    rfcMatches = rfcMatches.slice(0, 10);
    sectionMatches = sectionMatches.slice(0, 15);

    if (rfcMatches.length === 0 && sectionMatches.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No results for &ldquo;' + escapeHtml(query) + '&rdquo;</div>';
      searchOverlay.classList.add('active');
      return;
    }

    var html = '';

    // RFC title matches first
    for (var r = 0; r < rfcMatches.length; r++) {
      var rm = rfcMatches[r];
      html += '<div class="search-result-item" data-rfc="' + rm.rfcNumber + '">';
      html += '<div class="search-result-section">RFC ' + rm.rfcNumber;
      if (rm.shortTitle) html += ' &mdash; ' + escapeHtml(rm.shortTitle);
      html += '</div>';
      html += '<div class="search-result-text">' + highlightSearchText(rm.rfcTitle, query) + '</div>';
      html += '</div>';
    }

    // Section content matches
    for (var s = 0; s < sectionMatches.length; s++) {
      var sm = sectionMatches[s];
      var truncated = truncateAroundMatch(sm.text, query, 200);
      var highlighted = highlightSearchText(truncated, query);

      html += '<div class="search-result-item" data-rfc="' + sm.rfcNumber + '"';
      if (sm.sectionId) html += ' data-section="' + sm.sectionId + '"';
      html += '>';
      html += '<div class="search-result-section">RFC ' + sm.rfcNumber + ' &mdash; ' + escapeHtml(sm.sectionTitle || '') + '</div>';
      html += '<div class="search-result-text">' + highlighted + '</div>';
      html += '</div>';
    }

    searchResults.innerHTML = html;
    searchOverlay.classList.add('active');

    // Attach click handlers to results
    var items = searchResults.querySelectorAll('.search-result-item');
    for (var k = 0; k < items.length; k++) {
      (function (item) {
        item.addEventListener('click', function () {
          var rfcNum = parseInt(item.getAttribute('data-rfc'), 10);
          var sectionId = item.getAttribute('data-section');

          // Navigate to the RFC
          window.location.hash = '#rfc' + rfcNum;

          // If targeting a specific section, scroll to it after render
          if (sectionId) {
            setTimeout(function () {
              var el = document.getElementById(sectionId);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 150);
          }

          // Close search
          searchOverlay.classList.remove('active');
          searchInput.value = '';
          searchInput.blur();
        });
      })(items[k]);
    }
  }

  function highlightSearchText(text, query) {
    var escaped = escapeHtml(text);
    try {
      var regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
      return escaped.replace(regex, '<mark>$1</mark>');
    } catch (e) {
      return escaped;
    }
  }

  function truncateAroundMatch(text, query, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;

    var lowerText = text.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) idx = 0;

    var halfLen = Math.floor(maxLen / 2);
    var start = Math.max(0, idx - halfLen);
    var end = Math.min(text.length, start + maxLen);

    // Adjust start if we hit the end
    if (end === text.length) {
      start = Math.max(0, end - maxLen);
    }

    var prefix = start > 0 ? '...' : '';
    var suffix = end < text.length ? '...' : '';

    return prefix + text.substring(start, end) + suffix;
  }

  function setupSearch() {
    if (!searchInput || !searchOverlay || !searchResults) return;

    // Debounced input handler
    searchInput.addEventListener('input', function () {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function () {
        performSearch(searchInput.value.trim());
      }, 150);
    });

    // Re-show results on focus if query is long enough
    searchInput.addEventListener('focus', function () {
      var val = searchInput.value.trim();
      if (val.length >= 2) {
        performSearch(val);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }

      // Escape to close search
      if (e.key === 'Escape') {
        if (searchOverlay.classList.contains('active')) {
          searchOverlay.classList.remove('active');
          searchInput.value = '';
          searchInput.blur();
        }
      }
    });

    // Close search when clicking the overlay background
    searchOverlay.addEventListener('click', function (e) {
      if (e.target === searchOverlay) {
        searchOverlay.classList.remove('active');
        searchInput.value = '';
      }
    });
  }

  // ============================================================
  // Initialization
  // ============================================================

  function initApp() {
    // 1. Load and sort RFC data
    var rawData = window.RFC_DATA;
    if (!rawData || !Array.isArray(rawData)) {
      rawData = [];
    }

    rfcData = rawData.slice().sort(function (a, b) {
      return a.number - b.number;
    });

    // 2. Build lookup map by RFC number
    rfcMap = {};
    for (var i = 0; i < rfcData.length; i++) {
      rfcMap[rfcData[i].number] = rfcData[i];
    }

    // 3. Populate the sidebar with RFC browser
    populateSidebar();

    // 4. Setup hash-based routing
    setupRouting();

    // 5. Dark mode always
    initTheme();

    // 6. Setup search
    buildSearchIndex();
    setupSearch();

    // 7. Setup mobile sidebar toggle
    setupMobileSidebar();

    // 8. Setup background canvas particle animation
    setupCanvas();

    // 9. Listen for scroll events (active section tracking)
    window.addEventListener('scroll', onScroll, { passive: true });

    // 10. Navigate to the initial hash (or default)
    var initialRFC = parseHash();
    navigateTo(initialRFC);
  }

  // ============================================================
  // Start the Application
  // ============================================================

  // Wait for DOM if needed, though script is loaded at end of body
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
