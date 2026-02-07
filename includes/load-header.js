// Fetch and inject a shared header fragment into pages.
// Places the header at the start of <body> and sets the active nav item.
(function () {
    function resolveActiveNav(pathname) {
        var path = pathname || '/';
        if (path === '/' || path === '/index.html') return 'home';
        if (path.indexOf('/projects') === 0) return 'projects';
        if (path.indexOf('/articles') === 0) return 'articles';
        return null;
    }

    function markActiveNav(root) {
        var active = resolveActiveNav(window.location.pathname || '/');
        var links = root.querySelectorAll('a[data-nav]');
        links.forEach(function (link) {
            link.removeAttribute('aria-current');
            link.classList.remove('active');
            if (active && link.getAttribute('data-nav') === active) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('active');
            }
        });
    }

    function loadHeader() {
        var path = '/includes/header.html';
        fetch(path, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('Failed to load header');
            return res.text();
        }).then(function (html) {
            var container = document.createElement('div');
            container.innerHTML = html;
            var headerEl = container.querySelector('header') || container.firstElementChild;
            if (!headerEl) return;
            if (document.body.firstChild) document.body.insertBefore(headerEl, document.body.firstChild);
            else document.body.appendChild(headerEl);
            markActiveNav(headerEl);
        }).catch(function (err) {
            if (window.console) console.warn('Could not load header:', err);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadHeader);
    else loadHeader();
})();
