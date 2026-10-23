//most of this js is vibecoded since i dont care about webdev

// (requires highlight.js to be loaded first
//
// Options, set as attributes on the <script> tag that loads this file:
//   data-types="float3 float4 ..."  extra identifiers to colour as types
//   data-functions                  colour any identifier followed by "(" as a function call
//
// Lines containing <changed> get the .changed-line highlight.
// A quoted filename (e.g. #include "HashTable.hlsl") becomes a link that opens a popup when
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
    let modal = null;

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

        linkIncludes(codeEl);
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

    function getModal() {
        if (modal) return modal;
        modal = document.createElement('dialog');
        modal.className = 'include-modal';
        modal.innerHTML =
            '<div class="include-modal-header">' +
            '<span class="include-modal-title"></span>' +
            '<button class="include-modal-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<pre class="code"><code></code></pre>';
        document.body.appendChild(modal);
        modal.querySelector('.include-modal-close').addEventListener('click', () => modal.close());
        // Clicking the backdrop (outside the dialog box) closes it
        modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
        return modal;
    }

    function openInclude(name) {
        const dialog = getModal();
        const code = dialog.querySelector('code');
        dialog.querySelector('.include-modal-title').textContent = name;
        code.className = 'language-' + includeSources[name].language;
        delete code.dataset.highlighted;
        code.textContent = includeSources[name].code;
        highlightCode(code);
        dialog.showModal();
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
            openInclude(link.dataset.include);
        });

        document.querySelectorAll('pre.code code').forEach(highlightCode);
    });
})();
