// Fetch and inject a shared footer fragment into pages.
// Places the footer at the end of <body>.
(function(){
  function loadFooter(){
    var path = '/includes/footer.html';
    fetch(path, {cache: 'no-store'}).then(function(res){
      if (!res.ok) throw new Error('Failed to load footer');
      return res.text();
    }).then(function(html){
      var container = document.createElement('div');
      container.innerHTML = html;
      // Append the footer element to the document body
      var footerEl = container.querySelector('footer') || container.firstElementChild;
      if (footerEl) document.body.appendChild(footerEl);
    }).catch(function(err){
      // Fail silently in production; log in dev console
      if (window.console) console.warn('Could not load footer:', err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadFooter);
  else loadFooter();
})();
