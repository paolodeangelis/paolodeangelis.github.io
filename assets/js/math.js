window.typesetMath = function(root) {
  var target = root || document;

  if (!window.MathJax) {
    return Promise.resolve();
  }

  if (typeof window.MathJax.typesetPromise === 'function') {
    if (typeof window.MathJax.typesetClear === 'function') {
      window.MathJax.typesetClear([target]);
    }

    return window.MathJax.typesetPromise([target]).catch(function(error) {
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('MathJax typeset failed:', error);
      }
    });
  }

  if (window.MathJax.Hub) {
    window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, target]);
  }

  return Promise.resolve();
};

if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
  window.MathJax.startup.promise.then(function() {
    window.typesetMath(document);
  });
} else {
  window.typesetMath(document);
}
