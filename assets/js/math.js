if (!window.MathJax || !window.MathJax.Hub) {
  window.MathJax = window.MathJax || {};
} else {
  window.MathJax.Hub.Config({
    tex2jax: {
      inlineMath: [['$','$'], ['\\(','\\)']],
      displayMath: [['$$','$$'], ['\\[','\\]']],
      processEscapes: true
    }
  });

  window.MathJax.Hub.Queue(function () {
    window.MathJax.Hub.getAllJax();
  });
}
