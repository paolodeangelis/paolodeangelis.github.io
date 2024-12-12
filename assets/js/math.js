
  MathJax.Hub.Config({
    tex2jax: {
      inlineMath: [['$','$'], ['\\(','\\)']],
      displayMath: [['$$','$$'], ['\\[','\\]']],
      processEscapes: true
    }
  });

  MathJax.Hub.Queue(function () {
    var mathjax = MathJax.Hub.getAllJax();
  });
