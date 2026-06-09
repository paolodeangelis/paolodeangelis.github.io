var USE_LJ_MD_ANIMATION = true;
var LJ_MD_WORKER_VERSION = "2026-06-07-4000";
var LJ_MD_RENDER_COLOR_MODE = "type"; // "type" or "kinetic".
var LJ_MD_MOBILE_BREAKPOINT_PX = 640;
var LJ_MD_MOBILE_HELP_PROMPT_TEXT = "LJ MD | desktop recommended";
var LJ_MD_MOBILE_PARTICLE_CAP = 260;
var LJ_MD_MOBILE_TARGET_FPS = 14;
var LJ_MD_MOBILE_STEPS_PER_FRAME = 3;
var LJ_MD_ADAPTIVE_QUALITY_ENABLED = true;
var LJ_MD_ADAPTIVE_FALLBACK_ENABLED = true;
var LJ_MD_ADAPTIVE_SLOW_FRAME_MS = 95;
var LJ_MD_ADAPTIVE_SLOW_FRAME_LIMIT = 10;
var LJ_MD_PARTICLE_ALPHA_MIN = 0.30;
var LJ_MD_PARTICLE_ALPHA_MAX = 0.70;
var LJ_MD_SHOW_PRESSURE = false;
var LJ_MD_SHOW_ENERGY = false;
var LJ_MD_SHOW_TEMPERATURE = true;
var LJ_MD_SHOW_PARTICLE_COUNT = true;
var LJ_MD_GRAPH_HISTORY_LIMIT = 100;
var LJ_MD_HUD_BACKGROUND_ALPHA = 0.75;
var LJ_MD_HUD_PADDING_PX = 3;
var LJ_MD_GRAPH_WIDTH_PX = 250;
var LJ_MD_GRAPH_HEIGHT_PX = 52;
var LJ_MD_HELP_PROMPT_TEXT = "LJ MD | press h for help";
var LJ_MD_TYPE_COLORS_DARK = ["#f8f8f2", "#49eeba", "#e6455d", "#2a67eb", "#f154f7"];
var LJ_MD_TYPE_COLORS_LIGHT = ["#1a222c", "#22806b", "#c43855", "#134cc5", "#ca27cf"];
var particlesFallbackLoading = false;

function currentScriptUrl() {
  var script = document.querySelector('script[src*="/assets/js/main.js"], script[src$="assets/js/main.js"]');

  return script ? script.src : null;
}

function assetUrl(fileName) {
  var scriptUrl = currentScriptUrl();

  if (!scriptUrl || !window.URL) {
    return fileName;
  }

  return new URL(fileName, scriptUrl).toString();
}

function startParticlesFallback() {
  if (typeof particlesJS !== "function") {
    if (particlesFallbackLoading) {
      return;
    }

    particlesFallbackLoading = true;
    var fallbackScript = document.createElement("script");
    fallbackScript.defer = true;
    fallbackScript.src = assetUrl("particles.min.js");
    fallbackScript.onload = function() {
      particlesFallbackLoading = false;
      startParticlesFallback();
    };
    fallbackScript.onerror = function() {
      particlesFallbackLoading = false;
    };
    document.head.appendChild(fallbackScript);
    return;
  }

  var root = document.getElementById("particles-js");
  if (root) {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
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

  if (!root || !currentScriptUrl() || !window.Worker || !window.URL) {
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

  var worker = new Worker(assetUrl("lj-md-worker.js?v=" + encodeURIComponent(LJ_MD_WORKER_VERSION)));
  var latestFrame = null;
  var renderPending = false;
  var resizeTimer = null;
  var lastFrameTime = 0;
  var slowFrameCount = 0;
  var adaptiveLevel = 0;
  var fallbackActivated = false;
  var diagnosticsReadout = document.createElement("div");
  var descriptionReadout = document.createElement("div");
  var graphCanvas = document.createElement("canvas");
  var graphCtx = graphCanvas.getContext("2d");
  var helpVisible = false;
  var graphMode = false;
  var showTemperature = LJ_MD_SHOW_TEMPERATURE;
  var showPressure = LJ_MD_SHOW_PRESSURE;
  var showEnergy = LJ_MD_SHOW_ENERGY;
  var showParticleCount = LJ_MD_SHOW_PARTICLE_COUNT;
  var lastSampleSerial = -1;
  var histories = {
    temperature: [],
    pressure: [],
    energy: [],
    particleCount: []
  };

  diagnosticsReadout.className = "lj-md-diagnostics-readout";
  diagnosticsReadout.style.position = "absolute";
  diagnosticsReadout.style.right = "12px";
  diagnosticsReadout.style.bottom = "12px";
  diagnosticsReadout.style.zIndex = "2";
  diagnosticsReadout.style.fontFamily = "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
  diagnosticsReadout.style.fontSize = "12px";
  diagnosticsReadout.style.lineHeight = "1.25";
  diagnosticsReadout.style.textAlign = "right";
  diagnosticsReadout.style.pointerEvents = "none";
  diagnosticsReadout.style.opacity = "0.76";
  diagnosticsReadout.style.padding = LJ_MD_HUD_PADDING_PX + "px";
  diagnosticsReadout.style.whiteSpace = "pre-wrap";
  diagnosticsReadout.style.maxWidth = "46vw";
  descriptionReadout.className = "lj-md-description-readout";
  descriptionReadout.style.position = "absolute";
  descriptionReadout.style.left = "12px";
  descriptionReadout.style.bottom = "12px";
  descriptionReadout.style.zIndex = "2";
  descriptionReadout.style.fontFamily = "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
  descriptionReadout.style.fontSize = "12px";
  descriptionReadout.style.lineHeight = "1.25";
  descriptionReadout.style.pointerEvents = "none";
  descriptionReadout.style.opacity = "0.76";
  descriptionReadout.style.padding = LJ_MD_HUD_PADDING_PX + "px";
  descriptionReadout.style.whiteSpace = "pre-wrap";
  descriptionReadout.style.maxWidth = "46vw";
  descriptionReadout.textContent = LJ_MD_HELP_PROMPT_TEXT;
  graphCanvas.width = LJ_MD_GRAPH_WIDTH_PX;
  graphCanvas.height = LJ_MD_GRAPH_HEIGHT_PX * 3 + 18;
  graphCanvas.style.display = "none";
  root.style.position = root.style.position || "relative";
  root.appendChild(diagnosticsReadout);
  root.appendChild(descriptionReadout);
  diagnosticsReadout.appendChild(graphCanvas);

  function isMobileViewport() {
    return root.getBoundingClientRect().width <= LJ_MD_MOBILE_BREAKPOINT_PX;
  }

  function initialQualitySettings() {
    if (!isMobileViewport()) {
      return null;
    }

    return {
      maxParticles: LJ_MD_MOBILE_PARTICLE_CAP,
      targetFps: LJ_MD_MOBILE_TARGET_FPS,
      stepsPerFrame: LJ_MD_MOBILE_STEPS_PER_FRAME
    };
  }

  function graphWidth() {
    var rootWidth = root.getBoundingClientRect().width || LJ_MD_GRAPH_WIDTH_PX;

    if (rootWidth <= LJ_MD_MOBILE_BREAKPOINT_PX) {
      return Math.max(130, Math.min(LJ_MD_GRAPH_WIDTH_PX, Math.floor(rootWidth * 0.45)));
    }

    return LJ_MD_GRAPH_WIDTH_PX;
  }

  function applyHudLayout() {
    if (isMobileViewport()) {
      diagnosticsReadout.style.right = "8px";
      diagnosticsReadout.style.bottom = "40px";
      diagnosticsReadout.style.fontSize = "10px";
      diagnosticsReadout.style.lineHeight = "1.18";
      diagnosticsReadout.style.maxWidth = "44vw";
      descriptionReadout.style.left = "8px";
      descriptionReadout.style.bottom = "40px";
      descriptionReadout.style.fontSize = "10px";
      descriptionReadout.style.lineHeight = "1.18";
      descriptionReadout.style.maxWidth = "42vw";
    } else {
      diagnosticsReadout.style.right = "12px";
      diagnosticsReadout.style.bottom = "12px";
      diagnosticsReadout.style.fontSize = "12px";
      diagnosticsReadout.style.lineHeight = "1.25";
      diagnosticsReadout.style.maxWidth = "46vw";
      descriptionReadout.style.left = "12px";
      descriptionReadout.style.bottom = "12px";
      descriptionReadout.style.fontSize = "12px";
      descriptionReadout.style.lineHeight = "1.25";
      descriptionReadout.style.maxWidth = "46vw";
    }
  }

  function sizeCanvas() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var rect = root.getBoundingClientRect();
    var width = Math.max(320, Math.floor(rect.width * ratio));
    var height = Math.max(320, Math.floor(rect.height * ratio));

    applyHudLayout();
    updateHelpText();

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
      cold: [255, 255, 255],
      mid: [110, 204, 175],
      hot: [233, 100, 121],
      type: LJ_MD_TYPE_COLORS_DARK
    } : {
      cold: [77, 153, 135],
      mid: [34, 48, 60],
      hot: [211, 76, 96],
      type: LJ_MD_TYPE_COLORS_LIGHT
    };
  }

  function hudBackground() {
    return document.documentElement.getAttribute("data-theme") === "light" ?
      "rgba(255, 255, 255, " + LJ_MD_HUD_BACKGROUND_ALPHA + ")" :
      "rgba(26, 34, 44, " + LJ_MD_HUD_BACKGROUND_ALPHA + ")";
  }

  function readoutColor() {
    return document.documentElement.getAttribute("data-theme") === "light" ?
      "rgba(26, 34, 44, 0.86)" :
      "rgba(255, 255, 255, 0.86)";
  }

  function accentColors() {
    return document.documentElement.getAttribute("data-theme") === "light" ?
      {
        temperature: "#c43855",
        pressure: "#22806b",
        energy: "#134cc5",
        particleCount: "#946200",
        tick: "rgba(26, 34, 44, 0.5)"
      } :
      {
        temperature: "#e6455d",
        pressure: "#49eeba",
        energy: "#7aa2ff",
        particleCount: "#ffd166",
        tick: "rgba(255, 255, 255, 0.5)"
      };
  }

  function setHudTheme() {
    var background = hudBackground();
    var color = readoutColor();

    diagnosticsReadout.style.background = background;
    descriptionReadout.style.background = background;
    diagnosticsReadout.style.color = color;
    descriptionReadout.style.color = color;
  }

  function sendDiagnosticsRequest() {
    worker.postMessage({
      type: "diagnostics",
      pressure: showPressure,
      energy: showEnergy
    });
  }

  function pushHistory(list, value) {
    if (typeof value !== "number" || !isFinite(value)) {
      return;
    }

    list.push(value);

    if (list.length > LJ_MD_GRAPH_HISTORY_LIMIT) {
      list.splice(0, list.length - LJ_MD_GRAPH_HISTORY_LIMIT);
    }
  }

  function recordSample(frame) {
    if (frame.sampleSerial === lastSampleSerial) {
      return;
    }

    lastSampleSerial = frame.sampleSerial;
    pushHistory(histories.temperature, frame.temperatureK);

    if (showPressure && frame.pressureBar !== null) {
      pushHistory(histories.pressure, frame.pressureBar);
    }

    if (showEnergy && frame.totalEnergyEv !== null) {
      pushHistory(histories.energy, frame.totalEnergyEv);
    }

    if (showParticleCount) {
      pushHistory(histories.particleCount, frame.count);
    }
  }

  function formatMetric(value, digits, suffix) {
    if (typeof value !== "number" || !isFinite(value)) {
      return "--";
    }

    return value.toFixed(digits) + suffix;
  }

  function formatSimulationTime(frame) {
    var timePs = typeof frame.timePs === "number" && isFinite(frame.timePs) ? frame.timePs : 0;

    if (timePs >= 1000) {
      return "time = " + (timePs / 1000).toFixed(3) + " ns";
    }

    return "time = " + timePs.toFixed(1) + " ps";
  }

  function activeMetrics(frame) {
    var metrics = [];

    if (showTemperature) {
      metrics.push({
        key: "temperature",
        title: "T",
        text: "T = " + Math.round(frame.temperatureK) + " K -> " + Math.round(frame.targetTemperatureK) + " K",
        values: histories.temperature
      });
    }

    if (showPressure) {
      metrics.push({
        key: "pressure",
        title: "P",
        text: "P = " + formatMetric(frame.pressureBar, 0, " bar"),
        values: histories.pressure
      });
    }

    if (showEnergy) {
      metrics.push({
        key: "energy",
        title: "E",
        text: "E = " + formatMetric(frame.totalEnergyEv, 3, " eV"),
        values: histories.energy
      });
    }

    if (showParticleCount) {
      metrics.push({
        key: "particleCount",
        title: "N",
        text: "N = " + frame.count,
        values: histories.particleCount
      });
    }

    return metrics;
  }

  function updateHelpText() {
    if (isMobileViewport()) {
      descriptionReadout.textContent = LJ_MD_MOBILE_HELP_PROMPT_TEXT;
      return;
    }

    if (!helpVisible) {
      descriptionReadout.textContent = LJ_MD_HELP_PROMPT_TEXT;
      return;
    }

    descriptionReadout.textContent = [
      "LJ MD controls",
      "--------------------------------",
      "h  toggle help",
      "+  increase T",
      "-  decrease T",
      "t  toggle temperature",
      "p  toggle pressure",
      "e  toggle total energy",
      "n  toggle particle count",
      "g  toggle graph HUD",
      "left click  add atoms",
      "right click mouse repel/attract"
    ].join("\n");
  }

  function drawOnePlot(y, metric, colorMap) {
    var values = metric.values;
    var w = graphCanvas.width;
    var h = LJ_MD_GRAPH_HEIGHT_PX;
    var color = colorMap[metric.key];
    var plotLeft = 44;
    var plotRight = w - 2;
    var plotTop = y + 14;
    var plotBottom = y + h - 4;

    graphCtx.fillStyle = color;
    graphCtx.font = "12px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
    graphCtx.fillText(metric.title, 2, y + 11);

    graphCtx.strokeStyle = colorMap.tick;
    graphCtx.lineWidth = 1;

    if (values.length < 2) {
      return;
    }

    var min = values[0];
    var max = values[0];

    for (var i = 1; i < values.length; i += 1) {
      min = Math.min(min, values[i]);
      max = Math.max(max, values[i]);
    }

    if (metric.key === "particleCount" && max - min < 2) {
      var center = (max + min) * 0.5;
      min = center - 1;
      max = center + 1;
    }

    var span = Math.max(1e-12, max - min);
    graphCtx.fillStyle = colorMap.tick;
    graphCtx.font = "10px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
    graphCtx.textAlign = "right";
    graphCtx.fillText(max.toPrecision(3), plotLeft - 5, plotTop + 3);
    graphCtx.fillText(min.toPrecision(3), plotLeft - 5, plotBottom);

    for (var tick = 0; tick <= 2; tick += 1) {
      var yTick = plotTop + tick * (plotBottom - plotTop) / 2;
      graphCtx.beginPath();
      graphCtx.moveTo(plotLeft - 3, yTick);
      graphCtx.lineTo(plotLeft, yTick);
      graphCtx.stroke();
    }

    graphCtx.textAlign = "left";
    graphCtx.strokeStyle = color;
    graphCtx.lineWidth = 1.5;
    graphCtx.beginPath();

    for (var j = 0; j < values.length; j += 1) {
      var x = values.length === 1 ? plotLeft : plotLeft + j * (plotRight - plotLeft) / (values.length - 1);
      var yValue = plotTop + (plotBottom - plotTop) * (1 - (values[j] - min) / span);

      if (j === 0) {
        graphCtx.moveTo(x, yValue);
      } else {
        graphCtx.lineTo(x, yValue);
      }
    }

    graphCtx.stroke();
  }

  function updateDiagnostics(frame) {
    var metrics = activeMetrics(frame);

    setHudTheme();

    if (!graphMode) {
      graphCanvas.style.display = "none";
      diagnosticsReadout.textContent = metrics.map(function(metric) {
        return metric.text;
      }).concat(formatSimulationTime(frame)).join("\n");
      return;
    }

    diagnosticsReadout.textContent = "";
    graphCanvas.style.display = "block";
    graphCanvas.width = graphWidth();
    graphCanvas.height = Math.max(1, metrics.length) * LJ_MD_GRAPH_HEIGHT_PX + 18;
    diagnosticsReadout.appendChild(graphCanvas);

    graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    graphCtx.fillStyle = hudBackground();
    graphCtx.fillRect(0, 0, graphCanvas.width, graphCanvas.height);

    var colors = accentColors();
    for (var i = 0; i < metrics.length; i += 1) {
      drawOnePlot(i * LJ_MD_GRAPH_HEIGHT_PX, metrics[i], colors);
    }

    graphCtx.fillStyle = readoutColor();
    graphCtx.font = "12px SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace";
    graphCtx.textAlign = "right";
    graphCtx.fillText(formatSimulationTime(frame), graphCanvas.width - 2, graphCanvas.height - 4);
    graphCtx.textAlign = "left";
  }

  function stepDownQuality() {
    if (!LJ_MD_ADAPTIVE_QUALITY_ENABLED || adaptiveLevel >= 3 || fallbackActivated) {
      if (LJ_MD_ADAPTIVE_FALLBACK_ENABLED && adaptiveLevel >= 3 && !fallbackActivated) {
        fallbackActivated = true;
        worker.terminate();
        startParticlesFallback();
      }
      return;
    }

    adaptiveLevel += 1;

    if (adaptiveLevel === 1) {
      worker.postMessage({
        type: "setQuality",
        targetFps: Math.max(10, Math.floor(LJ_MD_MOBILE_TARGET_FPS)),
        stepsPerFrame: Math.max(2, Math.floor(LJ_MD_MOBILE_STEPS_PER_FRAME))
      });
    } else if (adaptiveLevel === 2) {
      worker.postMessage({
        type: "setQuality",
        targetFps: 10,
        stepsPerFrame: 2,
        maxParticles: Math.max(120, LJ_MD_MOBILE_PARTICLE_CAP)
      });
    } else {
      worker.postMessage({
        type: "setQuality",
        targetFps: 8,
        stepsPerFrame: 1,
        maxParticles: Math.max(100, Math.floor(LJ_MD_MOBILE_PARTICLE_CAP * 0.75))
      });
    }
  }

  function observeFrameRate() {
    if (!LJ_MD_ADAPTIVE_QUALITY_ENABLED || fallbackActivated) {
      return;
    }

    var now = performance.now();

    if (lastFrameTime > 0 && now - lastFrameTime > LJ_MD_ADAPTIVE_SLOW_FRAME_MS) {
      slowFrameCount += 1;
    } else {
      slowFrameCount = Math.max(0, slowFrameCount - 1);
    }

    lastFrameTime = now;

    if (slowFrameCount >= LJ_MD_ADAPTIVE_SLOW_FRAME_LIMIT) {
      slowFrameCount = 0;
      stepDownQuality();
    }
  }

  function alphaFor(value) {
    var s = Math.max(0, Math.min(1, value));

    return LJ_MD_PARTICLE_ALPHA_MIN + (LJ_MD_PARTICLE_ALPHA_MAX - LJ_MD_PARTICLE_ALPHA_MIN) * s;
  }

  function mixColor(a, b, t) {
    var s = Math.max(0, Math.min(1, t));
    var r = Math.round(a[0] + (b[0] - a[0]) * s);
    var g = Math.round(a[1] + (b[1] - a[1]) * s);
    var blue = Math.round(a[2] + (b[2] - a[2]) * s);

    return [r, g, blue];
  }

  function kineticColor(colors, value) {
    var rgb;

    if (value < 0.5) {
      rgb = mixColor(colors.cold, colors.mid, value * 2);
    } else {
      rgb = mixColor(colors.mid, colors.hot, (value - 0.5) * 2);
    }

    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alphaFor(value).toFixed(3) + ")";
  }

  function hexToRgb(hex) {
    var clean = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    var value = parseInt(clean.length === 3 ?
      clean.replace(/(.)/g, "$1$1") :
      clean, 16);

    return [
      (value >> 16) & 255,
      (value >> 8) & 255,
      value & 255
    ];
  }

  function typeColor(colors, typeId, value) {
    var palette = colors.type;
    var rgb = hexToRgb(palette[typeId % palette.length]);

    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alphaFor(value).toFixed(3) + ")";
  }

  function drawFrame(frame) {
    var colors = themeColors();
    var positions = new Float32Array(frame.positions);
    var kineticColors = new Float32Array(frame.kineticColors);
    var radii = new Float32Array(frame.radii);
    var typeIds = new Int16Array(frame.typeIds);
    var n = frame.count;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    for (var i = 0; i < n; i += 1) {
      var x = positions[2 * i];
      var y = positions[2 * i + 1];
      var colorValue = kineticColors[i];

      ctx.beginPath();
      ctx.fillStyle = LJ_MD_RENDER_COLOR_MODE === "type" ?
        typeColor(colors, typeIds[i], colorValue) :
        kineticColor(colors, colorValue);
      ctx.arc(x, y, radii[i], 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    recordSample(frame);
    updateHelpText();
    updateDiagnostics(frame);
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
      observeFrameRate();
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

  canvas.addEventListener("mousedown", function(event) {
    var rect = canvas.getBoundingClientRect();
    var ratioX = canvas.width / Math.max(1, rect.width);
    var ratioY = canvas.height / Math.max(1, rect.height);
    var x = (event.clientX - rect.left) * ratioX;
    var y = (event.clientY - rect.top) * ratioY;

    if (event.button === 0) {
      worker.postMessage({
        type: "addParticles",
        x: x,
        y: y
      });
    } else if (event.button === 2) {
      worker.postMessage({
        type: "toggleMouseWall",
        x: x,
        y: y
      });
      event.preventDefault();
    }
  });

  canvas.addEventListener("contextmenu", function(event) {
    event.preventDefault();
  });

  canvas.addEventListener("mouseleave", function() {
    worker.postMessage({
      type: "mouse",
      active: false
    });
  });

  window.addEventListener("keydown", function(event) {
    var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";

    if (tag === "input" || tag === "textarea" || tag === "select" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "h" || event.key === "H") {
      helpVisible = !helpVisible;
      updateHelpText();
      event.preventDefault();
    } else if (event.key === "t" || event.key === "T") {
      showTemperature = !showTemperature;
      event.preventDefault();
    } else if (event.key === "p" || event.key === "P") {
      showPressure = !showPressure;
      sendDiagnosticsRequest();
      event.preventDefault();
    } else if (event.key === "e" || event.key === "E") {
      showEnergy = !showEnergy;
      sendDiagnosticsRequest();
      event.preventDefault();
    } else if (event.key === "n" || event.key === "N") {
      showParticleCount = !showParticleCount;
      event.preventDefault();
    } else if (event.key === "g" || event.key === "G") {
      graphMode = !graphMode;
      event.preventDefault();
    } else if (event.key === "+" || event.key === "=") {
      worker.postMessage({
        type: "adjustTemperature",
        deltaK: event.repeat ? 10 : 1
      });
      event.preventDefault();
    } else if (event.key === "-" || event.key === "_") {
      worker.postMessage({
        type: "adjustTemperature",
        deltaK: event.repeat ? -10 : -1
      });
      event.preventDefault();
    }
  });

  sizeCanvas();
  setHudTheme();
  updateHelpText();
  worker.postMessage({
    type: "start",
    width: canvas.width,
    height: canvas.height,
    quality: initialQualitySettings()
  });
  sendDiagnosticsRequest();
}

document.addEventListener("DOMContentLoaded", function() {
  new SweetScroll({});

  if (USE_LJ_MD_ANIMATION) {
    startLJAnimation();
  } else {
    startParticlesFallback();
  }
}, false);
