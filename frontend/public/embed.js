/*
 * ATM widget helper, optional: sizes every ATM widget iframe on the page to
 * its content. Without it an iframe keeps the height it was given. It only
 * listens for height messages from ATM's own address; it reads nothing on
 * the page and sets no cookie.
 */
(function () {
  if (window.__atmEmbed) return;
  window.__atmEmbed = true;
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : '';
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.origin !== origin || !data || data.type !== 'atm-embed:height') return;
    var height = Math.min(Math.max(Number(data.height) || 0, 60), 5000);
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        frames[i].style.height = height + 'px';
        return;
      }
    }
  });
})();
