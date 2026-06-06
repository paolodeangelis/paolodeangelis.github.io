var USE_LJ_MD_ANIMATION = true;

function startParticlesFallback() {
  if (typeof particlesJS !== "function") {
    return;
  }

  particlesJS("particles-js", {
    particles: {
      number: {
        value: 200,
        density: {
          enable: true,
          value_area: 800
        }
      },
      color: {
        value: ["#ffffff", "#6ECCAF", "#E96479", "#1a222c"]
      },
      shape: {
        type: "circle",
        stroke: {
          width: 0,
          color: "#000000"
        },
        polygon: {
          nb_sides: 5
        },
        image: {
          src: "img/github.svg",
          width: 100,
          height: 100
        }
      },
      opacity: {
        value: 1,
        random: true,
        anim: {
          enable: true,
          speed: 1,
          opacity_min: 0.3,
          sync: false
        }
      },
      size: {
        value: 7,
        random: true,
        anim: {
          enable: false,
          speed: 3,
          size_min: 0.8,
          sync: false
        }
      },
      line_linked: {
        enable: false,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 3,
        direction: "none",
        random: true,
        straight: false,
        out_mode: "bounce",
        bounce: true,
        attract: {
          enable: false,
          rotateX: 600,
          rotateY: 600
        }
      }
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: {
          enable: true,
          mode: "push"
        },
        onclick: {
          enable: false,
          mode: "repulse"
        },
        resize: true
      },
      modes: {
        grab: {
          distance: 400,
          line_linked: {
            opacity: 1
          }
        },
        bubble: {
          distance: 20,
          size: 0,
          duration: 2,
          opacity: 0,
          speed: 3
        },
        repulse: {
          distance: 40,
          duration: 0.4
        },
        push: {
          particles_nb: 4
        },
        remove: {
          particles_nb: 2
        }
      }
    },
    retina_detect: true
  });
}

function startLJAnimation() {
  var root = document.getElementById("particles-js");
  var script = document.querySelector('script[src*="/assets/js/main.js"], script[src$="assets/js/main.js"]');

  if (!root || !script || !window.Worker || !window.URL) {
    startParticlesFallback();
    return;
  }

  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  var canvas = document.createElement("canvas");
  canvas.className = "particles-js-canvas-el lj-md-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  root.appendChild(canvas);

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    startParticlesFallback();
    return;
  }

  var worker = new Worker(new URL("lj-md-worker.js", script.src));
  var latestFrame = null;
  var renderPending = false;
  var resizeTimer = null;
  var temperatureReadout = document.createElement("div");

  temperatureReadout.className = "lj-md-temperature-readout";
  temperatureReadout.style.position = "absolute";
  temperatureReadout.style.left = "12px";
  temperatureReadout.style.bottom = "12px";
  temperatureReadout.style.zIndex = "2";
  temperatureReadout.style.fontFamily = "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
  temperatureReadout.style.fontSize = "12px";
  temperatureReadout.style.lineHeight = "1";
  temperatureReadout.style.pointerEvents = "none";
  temperatureReadout.style.opacity = "0.72";
  root.style.position = root.style.position || "relative";
  root.appendChild(temperatureReadout);

  function sizeCanvas() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var rect = root.getBoundingClientRect();
    var width = Math.max(320, Math.floor(rect.width * ratio));
    var height = Math.max(320, Math.floor(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      worker.postMessage({
        type: "resize",
        width: width,
        height: height,
        pixelRatio: ratio
      });
    }
  }

  function themeColors() {
    var isDark = document.documentElement.getAttribute("data-theme") !== "light";

    return isDark ? {
      cold: [255, 255, 255, 0.86],
      mid: [110, 204, 175, 0.92],
      hot: [233, 100, 121, 0.94]
    } : {
      cold: [77, 153, 135, 0.72],
      mid: [34, 48, 60, 0.78],
      hot: [211, 76, 96, 0.82]
    };
  }

  function mixColor(a, b, t) {
    var s = Math.max(0, Math.min(1, t));
    var r = Math.round(a[0] + (b[0] - a[0]) * s);
    var g = Math.round(a[1] + (b[1] - a[1]) * s);
    var blue = Math.round(a[2] + (b[2] - a[2]) * s);
    var alpha = a[3] + (b[3] - a[3]) * s;

    return "rgba(" + r + "," + g + "," + blue + "," + alpha.toFixed(3) + ")";
  }

  function kineticColor(colors, value) {
    if (value < 0.5) {
      return mixColor(colors.cold, colors.mid, value * 2);
    }

    return mixColor(colors.mid, colors.hot, (value - 0.5) * 2);
  }

  function drawFrame(frame) {
    var colors = themeColors();
    var positions = new Float32Array(frame.positions);
    var kineticColors = new Float32Array(frame.kineticColors);
    var radii = new Float32Array(frame.radii);
    var n = frame.count;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    for (var i = 0; i < n; i += 1) {
      var x = positions[2 * i];
      var y = positions[2 * i + 1];
      var colorValue = kineticColors[i];

      ctx.beginPath();
      ctx.fillStyle = kineticColor(colors, colorValue);
      ctx.arc(x, y, radii[i], 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    temperatureReadout.style.color = document.documentElement.getAttribute("data-theme") === "light" ?
      "rgba(26, 34, 44, 0.82)" :
      "rgba(255, 255, 255, 0.82)";
    temperatureReadout.textContent = "T = " + Math.round(frame.temperatureK) + " K";
  }

  function requestRender() {
    if (renderPending || !latestFrame) {
      return;
    }

    renderPending = true;
    window.requestAnimationFrame(function() {
      renderPending = false;
      drawFrame(latestFrame);
    });
  }

  worker.onmessage = function(event) {
    if (event.data.type === "frame") {
      latestFrame = event.data;
      requestRender();
    }
  };

  worker.onerror = function() {
    worker.terminate();
    startParticlesFallback();
  };

  window.addEventListener("resize", function() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(sizeCanvas, 120);
  });

  canvas.addEventListener("mousemove", function(event) {
    var rect = canvas.getBoundingClientRect();
    var ratioX = canvas.width / Math.max(1, rect.width);
    var ratioY = canvas.height / Math.max(1, rect.height);

    worker.postMessage({
      type: "mouse",
      active: true,
      x: (event.clientX - rect.left) * ratioX,
      y: (event.clientY - rect.top) * ratioY
    });
  });

  canvas.addEventListener("mouseleave", function() {
    worker.postMessage({
      type: "mouse",
      active: false
    });
  });

  sizeCanvas();
  worker.postMessage({
    type: "start",
    width: canvas.width,
    height: canvas.height
  });
}

document.addEventListener("DOMContentLoaded", function() {
  new SweetScroll({});

  if (USE_LJ_MD_ANIMATION) {
    startLJAnimation();
  } else {
    startParticlesFallback();
  }
}, false);
