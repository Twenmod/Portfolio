//most of this js is vibecoded since i dont care about webdev

// (requires highlight.js to be loaded first
//
// Options, set as attributes on the <script> tag that loads this file:
//   data-types="float3 float4 ..."  extra identifiers to colour as types
//   data-functions                  colour any identifier followed by "(" as a function call
//
// Lines containing <changed> get the .changed-line highlight.
// "Name:" inside call arguments (e.g. Foo(Key, Cascade: 0)) gets the .arg-label style.
// A quoted filename (e.g. #include "HashTable.hlsl") becomes a link that expands the file below that line when
// the page has a matching <script type="text/plain" data-include="HashTable.hlsl"> block.
// Add data-language="cpp" (any highlight.js language) to that block to change its highlighting, default is hlsl.
(function () {
    const script = document.currentScript;
    const types = (script.dataset.types || '').trim().split(/\s+/).filter(Boolean);
    const typeFinder = types.length ? new RegExp('\\b(' + types.join('|') + ')\\b', 'g') : null;
    const highlightFunctions = script.hasAttribute('data-functions');

    const markerFinder = /<changed>/i;
    const markerFinderG = /<changed>/gi;

    const includeSources = {};

    function highlightCode(codeEl) {
        const original = codeEl.textContent || '';
        const textLines = original.split('\n');
        const toHighlight = textLines.map(l => markerFinder.test(l));

        const tokenized = original.replace(markerFinderG, '');
        codeEl.textContent = tokenized;

        try { hljs.highlightElement(codeEl); } catch (e) { /* ignore highlight errors */ }

        const renderedLines = (codeEl.innerHTML || '').split('\n');

        for (let i = 0; i < renderedLines.length; i++) {
            if (toHighlight[i]) {
                renderedLines[i] = renderedLines[i].replace(/&lt;changed&gt;/gi, '');
                renderedLines[i] = renderedLines[i].replace(/<\/?changed[^>]*>/gi, '');
                renderedLines[i] = '<span class="changed-line">' + renderedLines[i] + '</span>';
            }
        }

        codeEl.innerHTML = renderedLines.join('\n');

        if (typeFinder) {
            codeEl.innerHTML = codeEl.innerHTML.replace(typeFinder, '<span class="hljs-type">$1</span>');
        }

        if (highlightFunctions) {
            // Highlight custom function calls (any identifier followed by opening parenthesis)
            codeEl.innerHTML = codeEl.innerHTML.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, function (match, funcName) {
                // Skip if already wrapped in a span (e.g., built-in functions, keywords)
                if (match.includes('<span')) return match;
                return '<span class="hljs-title function_' + funcName + '">' + funcName + '</span>';
            });
        }

        markArgLabels(codeEl);

        linkIncludes(codeEl);
    }

    // Wraps "Name:" or "[...]:" right after a "(" or "," (e.g. HashTableAdd(Key, Cascade: 0, [&]: Index)) in .arg-label
    function markArgLabels(codeEl) {
        const labelFinder = /([(,]\s*)((?:[A-Za-z_][A-Za-z0-9_]*|\[[^\]\s]*\])\s*:(?!:)[ \t]*)/g;
        const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            // Comments and strings can contain "a, b:" too
            if (node.parentElement.closest('.hljs-comment, .hljs-string, .hljs-meta')) return;
            if (!labelFinder.test(node.data)) return;
            labelFinder.lastIndex = 0;

            const fragment = document.createDocumentFragment();
            let last = 0;
            node.data.replace(labelFinder, (match, before, label, offset) => {
                fragment.appendChild(document.createTextNode(node.data.slice(last, offset) + before));
                const span = document.createElement('span');
                span.className = 'arg-label';
                span.textContent = label;
                fragment.appendChild(span);
                last = offset + match.length;
            });
            fragment.appendChild(document.createTextNode(node.data.slice(last)));
            node.parentNode.replaceChild(fragment, node);
        });
    }

    function linkIncludes(codeEl) {
        codeEl.querySelectorAll('span').forEach(span => {
            if (span.children.length) return;
            const match = span.textContent.trim().match(/^["<]([^">]+)[">]$/);
            if (!match || !(match[1] in includeSources)) return;
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'include-link';
            link.dataset.include = match[1];
            link.title = 'View ' + match[1];
            span.parentNode.replaceChild(link, span);
            link.appendChild(span);
        });
    }

    // Grows the panel open from zero height, or shrinks it closed
    function animatePanel(panel, opening) {
        const collapsed = { height: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 };
        const expanded = { height: panel.offsetHeight + 'px', opacity: 1 };
        return panel.animate(opening ? [collapsed, expanded] : [expanded, collapsed],
            { duration: 150, easing: 'ease-out' });
    }

    // Inserts the include's source as a panel directly below the line containing the link
    function toggleInclude(link) {
        if (link.includePanel) {
            const closing = link.includePanel;
            link.includePanel = null;
            animatePanel(closing, false).onfinish = () => closing.remove();
            return;
        }

        const source = includeSources[link.dataset.include];
        const panel = document.createElement('span');
        panel.className = 'include-panel';
        panel.innerHTML =
            '<span class="include-panel-header">' +
            '<span class="include-panel-title"></span>' +
            '<button class="include-panel-close" aria-label="Close">&times;</button>' +
            '</span>' +
            '<pre class="code"><code></code></pre>' +
            '<span class="include-panel-resize"></span>';
        panel.querySelector('.include-panel-title').textContent = link.dataset.include;
        panel.querySelector('.include-panel-close').addEventListener('click', () => toggleInclude(link));

        const code = panel.querySelector('code');
        code.className = 'language-' + source.language;
        code.textContent = source.code.replace(/\n$/, '');
        highlightCode(code);

        // Find the newline ending the link's line, and insert the panel right after it
        const codeEl = link.closest('code');
        let lineNode = link;
        while (lineNode.parentNode !== codeEl) lineNode = lineNode.parentNode;
        let node = lineNode.nextSibling;
        while (node && !(node.nodeType === Node.TEXT_NODE && node.data.includes('\n'))) node = node.nextSibling;

        if (node) {
            const rest = node.splitText(node.data.indexOf('\n') + 1);
            codeEl.insertBefore(panel, rest);
        } else {
            codeEl.appendChild(panel);
        }
        link.includePanel = panel;

        // Start at most 60% of the screen tall, the user can drag the bottom edge to resize
        const pre = panel.querySelector('pre');
        pre.style.height = Math.min(pre.scrollHeight, window.innerHeight * 0.6) + 'px';
        animatePanel(panel, true);

        const handle = panel.querySelector('.include-panel-resize');
        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = pre.offsetHeight;
            handle.setPointerCapture(e.pointerId);
            handle.classList.add('dragging');

            const onMove = ev => { pre.style.height = Math.max(0, startHeight + ev.clientY - startY) + 'px'; };
            const onUp = () => {
                handle.classList.remove('dragging');
                handle.removeEventListener('pointermove', onMove);
                handle.removeEventListener('pointerup', onUp);
                handle.removeEventListener('pointercancel', onUp);
            };
            handle.addEventListener('pointermove', onMove);
            handle.addEventListener('pointerup', onUp);
            handle.addEventListener('pointercancel', onUp);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!window.hljs) return;

        document.querySelectorAll('script[type="text/plain"][data-include]').forEach(s => {
            includeSources[s.dataset.include] = {
                code: s.textContent.replace(/^\n/, '').replace(/\s+$/, '') + '\n',
                language: s.dataset.language || 'hlsl'
            };
        });

        document.addEventListener('click', e => {
            const link = e.target.closest('.include-link');
            if (!link) return;
            e.preventDefault();
            toggleInclude(link);
        });

        document.querySelectorAll('pre.code code').forEach(highlightCode);
    });
})();
