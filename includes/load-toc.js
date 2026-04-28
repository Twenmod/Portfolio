// Fetch and inject a floating Table-of-Contents for article pages.
(function () {
  function slugify(text) {
    return text.toString().toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-');
  }

  function buildTOC(tocEl) {
    var _tocRevealed = false;
    // Prefer an explicit `.toc-section` (used on projects) so we collect headings
    // from multiple `.article-content` blocks. Fallback to a single `.article-content`.
    var container = document.querySelector('.toc-section') || document.querySelector('.article-content');
    if (!container) return;

    // place the toc inside the nearest section-like container so sticky is bounded by that section
    var section = container.closest('.toc-section') || container.closest('.section') || container.parentElement;

    // collect headings we want in the TOC (scan the chosen container for all h2/h3/h4)
    var headings = container.querySelectorAll('h2, h3, h4');
    if (!headings.length) return;

    var list = tocEl.querySelector('.toc-list');
    list.innerHTML = '';

    // ensure unique ids (some pages reuse the same id attribute) by tracking used ids
    var usedIds = Object.create(null);
    headings.forEach(function (h) {
      var base = (h.id && h.id.trim()) ? h.id.trim() : slugify(h.textContent || h.innerText || 'heading');
      var uid = base;
      var i = 1;
      while (usedIds[uid]) {
        uid = base + '-' + i;
        i++;
      }
      if (!h.id || h.id !== uid) h.id = uid;
      usedIds[uid] = true;
      var li = document.createElement('li');
      li.className = 'toc-item toc-' + (h.tagName || '').toLowerCase();
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent || h.innerText;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var rect = document.getElementById(h.id).getBoundingClientRect();
        var offset = window.scrollY + rect.top - (document.querySelector('.site-header') ? document.querySelector('.site-header').offsetHeight + 12 : 80);
        window.scrollTo({ top: offset, behavior: 'smooth' });
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    // append the toc inside the section so we can bound its movement
    try { section.appendChild(tocEl); } catch (e) { document.body.appendChild(tocEl); }

    // helper measurements
    var siteHeader = document.querySelector('.site-header');
    var tocLinks = Array.from(tocEl.querySelectorAll('a'));
    var headerOffset = (siteHeader ? siteHeader.offsetHeight + 16 : 80);
    var gap = 24; // gap between article and toc

    function recalc() {
      headerOffset = (siteHeader ? siteHeader.offsetHeight + 16 : 80);
      // unlock width first so it can shrink/grow on resize, then lock after measurement
      tocEl.style.width = '';
      var measured = tocEl.offsetWidth;
      tocEl.style.width = measured + 'px'; // lock width to avoid reflow jumps while scrolling
    }

    function updateScrollState() {
      var sectionRect = section.getBoundingClientRect();
      var articleRect = container.getBoundingClientRect();
      var tocRect = tocEl.getBoundingClientRect();
      var tocHeight = tocRect.height;

      var sectionTopPage = window.scrollY + sectionRect.top;
      var sectionBottomPage = sectionTopPage + sectionRect.height;
      var fixedTop = headerOffset;

      // compute left offsets using bounding rects (viewport coords) so it scales correctly
      // articleRect.left and sectionRect.left are viewport-based; subtracting gives offsets relative to section
      var leftRelativeToSection = (articleRect.left - sectionRect.left) - tocRect.width - gap; // for position:absolute inside section
      var fixedLeft = articleRect.left - tocRect.width - gap; // for position:fixed (viewport coords)
      // clamp to viewport so the TOC doesn't get positioned off-screen
      var minLeft = 12;
      var maxLeft = Math.max(window.innerWidth - tocRect.width - 12, minLeft);
      if (!isFinite(fixedLeft) || fixedLeft < minLeft) fixedLeft = minLeft;
      if (fixedLeft > maxLeft) fixedLeft = maxLeft;
      if (!isFinite(leftRelativeToSection) || leftRelativeToSection < minLeft) leftRelativeToSection = minLeft;
      if (leftRelativeToSection > maxLeft) leftRelativeToSection = maxLeft;

      // decide state
      if (window.scrollY + fixedTop * 0.75 <= sectionTopPage) {
        // stick to top of section (absolute)
        tocEl.style.position = 'absolute';
        tocEl.style.top = Math.max(section.offsetTop + fixedTop * 0.25, 0) + 'px';
        tocEl.style.left = (leftRelativeToSection) + 'px';
      } else if (window.scrollY + fixedTop + tocHeight >= sectionBottomPage) {
        // stick to bottom of section
        tocEl.style.position = 'absolute';
        var topPos = sectionRect.height - tocHeight - 16; // 16px padding
        if (topPos < 0) topPos = 0;
        tocEl.style.top = topPos + 'px';
        tocEl.style.left = (leftRelativeToSection) + 'px';
      } else {
        // fixed to viewport
        tocEl.style.position = 'fixed';
        tocEl.style.top = fixedTop + 'px';
        tocEl.style.left = fixedLeft + 'px';
      }

      // ensure the TOC is visible (sometimes styles or positioning can hide it)
      tocEl.style.display = 'block';

      // scrollspy: highlight current section
      var fromTop = window.scrollY + headerOffset;
      var current = headings[0];
      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        if (window.scrollY + h.getBoundingClientRect().top <= fromTop + 4) current = h;
      }
      tocLinks.forEach(function (a) { a.classList.remove('active'); });
      var active = tocEl.querySelector('a[href="#' + (current.id) + '"]');
      if (active) active.classList.add('active');
    }

    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', function () { recalc(); updateScrollState(); });
    // initial: run once immediately, then again shortly after to stabilise measurements
    recalc(); updateScrollState();
    setTimeout(function () {
      recalc(); updateScrollState();
      // reveal TOC after we've positioned it (only once)
      try {
        if (!_tocRevealed) {
          _tocRevealed = true;
          tocEl.style.visibility = 'visible';
          tocEl.style.opacity = '1';
          // remove the transition after it finishes so subsequent position updates don't animate
          var _cleanup = function () { try { tocEl.style.transition = ''; } catch (e) { }; tocEl.removeEventListener('transitionend', _cleanup); };
          tocEl.addEventListener('transitionend', _cleanup);
        }
      } catch (e) { }
    }, 120);
  }

  function loadTOC() {
    var path = '/includes/article-toc.html';
    fetch(path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load toc');
      return res.text();
    }).then(function (html) {
      var container = document.createElement('div');
      container.innerHTML = html;
      var tocEl = container.querySelector('#article-toc') || container.firstElementChild;
      if (!tocEl) return;

      // hide initially to avoid a flash at top-left while measurements occur
      tocEl.style.visibility = 'hidden';
      tocEl.style.opacity = '0';
      tocEl.style.transition = 'opacity 160ms linear, visibility 0s linear 300ms';

      document.body.appendChild(tocEl);
      buildTOC(tocEl);
    }).catch(function (err) {
      if (window.console) console.warn('Could not load article toc:', err);
    });
  }

  function initImageCompare() {
    var containers = document.querySelectorAll('.img-compare');
    if (!containers.length) return;

    containers.forEach(function (container) {
      var imgAfter = container.querySelector('.img-after');
      var imgBefore = container.querySelector('.img-before');
      var handle = container.querySelector('.handle');
      var overlay = container.querySelector('.overlay');

      // Skip incomplete markup so generic initialization remains safe across pages.
      if (!imgAfter || !imgBefore || !handle) return;

      var beforeSrc = container.dataset.before;
      var afterSrc = container.dataset.after;
      var beforeLabel = container.querySelector('.before-label');
      var afterLabel = container.querySelector('.after-label');

      var offset = parseFloat(container.dataset.offset || '0.5');
      if (!isFinite(offset)) offset = 0.5;
      offset = Math.max(0, Math.min(1, offset));

      var hideOnSlide = container.dataset.hideOnSlide !== 'false';
      var overlayEnabled = container.dataset.overlay !== 'false';
      var hasIdleAnimation = container.classList.contains('idle-animation');

      var sliding = false;
      var bounds = null;
      var idleTimer = null;
      var isAnimating = false;
      var animationStartTime = null;
      var lastInteractionTime = Date.now();

      if (beforeSrc) imgBefore.src = beforeSrc;
      if (afterSrc) imgAfter.src = afterSrc;

      function makeLabelLink(labelEl, href) {
        if (!labelEl || !href) return;

        var link = document.createElement('a');
        link.className = labelEl.className;
        link.textContent = labelEl.textContent || '';
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        link.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        link.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
        labelEl.replaceWith(link);
      }

      makeLabelLink(beforeLabel, beforeSrc);
      makeLabelLink(afterLabel, afterSrc);

      function updateBounds() {
        bounds = container.getBoundingClientRect();
        update();
      }

      function update() {
        if (!bounds) return;

        var x = offset * 100;
        imgBefore.style.clipPath = 'inset(0 ' + (100 - x) + '% 0 0)';
        handle.style.left = x + '%';

        if (overlayEnabled && overlay) {
          overlay.style.opacity = (hideOnSlide && sliding) ? 0 : 1;
        }
      }

      function pointerX(e) {
        if (e.touches && e.touches.length) return e.touches[0].clientX;
        return e.clientX;
      }

      function move(e) {
        if (!sliding || !bounds) return;
        var x = pointerX(e) - bounds.left;
        x = Math.max(0, Math.min(x, bounds.width));
        offset = x / bounds.width;
        update();
      }

      function start(e) {
        if (e.target && e.target.closest && e.target.closest('a, button, input, textarea, select, option, label')) return;
        sliding = true;
        isAnimating = false;
        if (idleTimer) clearTimeout(idleTimer);
        move(e);
        e.preventDefault();
      }

      function end() {
        if (!sliding) return;
        sliding = false;
        lastInteractionTime = Date.now();
        update();

        if (hasIdleAnimation) {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(function () {
            startIdleAnimation();
          }, 5000);
        }
      }

      function startIdleAnimation() {
        if (sliding || isAnimating) return;
        isAnimating = true;
        animationStartTime = Date.now();
        animateIdle();
      }

      function animateIdle() {
        if (!isAnimating || sliding) return;

        var elapsed = (Date.now() - animationStartTime) / 1000;
        var sine = Math.sin(elapsed * Math.PI * 0.1);
        offset = 0.5 + sine * 0.5;
        update();

        requestAnimationFrame(animateIdle);
      }

      window.addEventListener('resize', updateBounds);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      window.addEventListener('touchmove', move, { passive: true });
      window.addEventListener('touchend', end, { passive: true });

      container.addEventListener('mousedown', start);
      container.addEventListener('touchstart', start, { passive: false });

      imgAfter.addEventListener('load', updateBounds);
      updateBounds();

      if (hasIdleAnimation) {
        startIdleAnimation();
      }
    });
  }

  function initArticleEnhancements() {
    loadTOC();
    initImageCompare();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArticleEnhancements);
  else initArticleEnhancements();

})();
