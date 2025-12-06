// Fetch and inject a floating Table-of-Contents for article pages.
(function(){
  function slugify(text){
    return text.toString().toLowerCase().trim()
      .replace(/\s+/g,'-')
      .replace(/[^a-z0-9\-]/g,'')
      .replace(/-+/g,'-');
  }

  function buildTOC(tocEl){
    var container = document.querySelector('.article-content');
    if (!container) return;

    // place the toc inside the nearest section so sticky is bounded by that section
    var section = container.closest('.section') || container.parentElement;

    // collect headings we want in the TOC
    var headings = container.querySelectorAll('h2, h3');
    if (!headings.length) return;

    var list = tocEl.querySelector('.toc-list');
    list.innerHTML = '';

    headings.forEach(function(h){
      if (!h.id) h.id = slugify(h.textContent || h.innerText || 'heading');
      var li = document.createElement('li');
      li.className = 'toc-item toc-' + (h.tagName || '').toLowerCase();
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent || h.innerText;
      a.addEventListener('click', function(e){
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

    function recalc(){
      headerOffset = (siteHeader ? siteHeader.offsetHeight + 16 : 80);
      // unlock width first so it can shrink/grow on resize, then lock after measurement
      tocEl.style.width = '';
      var measured = tocEl.offsetWidth;
      tocEl.style.width = measured + 'px'; // lock width to avoid reflow jumps while scrolling
    }

    function updateScrollState(){
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

      // decide state
      if (window.scrollY + fixedTop*0.5 <= sectionTopPage) {
        // stick to top of section (absolute)
        tocEl.style.position = 'absolute';
        tocEl.style.top = Math.max(container.offsetTop, 0) + 'px';
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

      // scrollspy: highlight current section
      var fromTop = window.scrollY + headerOffset;
      var current = headings[0];
      for (var i = 0; i < headings.length; i++){
        var h = headings[i];
        if (window.scrollY + h.getBoundingClientRect().top <= fromTop + 4) current = h;
      }
      tocLinks.forEach(function(a){ a.classList.remove('active'); });
      var active = tocEl.querySelector('a[href="#' + (current.id) + '"]');
      if (active) active.classList.add('active');
    }

    window.addEventListener('scroll', updateScrollState, {passive:true});
    window.addEventListener('resize', function(){ recalc(); updateScrollState(); });
    // initial
    setTimeout(function(){ recalc(); updateScrollState(); }, 120);
  }

  function loadTOC(){
    var path = '/includes/article-toc.html';
    fetch(path, {cache: 'no-store'}).then(function(res){
      if (!res.ok) throw new Error('Failed to load toc');
      return res.text();
    }).then(function(html){
      var container = document.createElement('div');
      container.innerHTML = html;
      var tocEl = container.querySelector('#article-toc') || container.firstElementChild;
      if (!tocEl) return;

      document.body.appendChild(tocEl);
      buildTOC(tocEl);
    }).catch(function(err){
      if (window.console) console.warn('Could not load article toc:', err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadTOC);
  else loadTOC();

})();
