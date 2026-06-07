var LJ_MD_PARTICLE_COUNT = 440;
var LJ_MD_CLICK_ADD_PARTICLE_COUNT = 10;
var LJ_MD_MAX_PARTICLE_COUNT = 4000;
var LJ_MD_PARALLEL_THRESHOLD = 5000;
var LJ_MD_WORKER_COUNT = 4;
var LJ_MD_FORCE_MODE = "auto"; // "auto", "serial", or "parallel"
var LJ_MD_PARALLEL_FORCE_BACKEND = "optimized"; // "exact", "optimized", or "approx"; only used by parallel force mode.
var LJ_MD_SERIAL_USE_CELL_LIST = true;
var LJ_MD_APPROX_FORCE_TABLE_BITS = 9; // 2^9 = 512 samples per type pair.
var LJ_MD_INITIAL_TEMPERATURE_K = 300;
var LJ_MD_TIME_STEP_PS = 0.0025;
var LJ_MD_STEPS_PER_FRAME = 5;
var LJ_MD_TARGET_FPS = 20;
var LJ_MD_DENSITY_2D = 0.09;
var LJ_MD_THERMOSTAT_ENABLED = true;
var LJ_MD_THERMOSTAT_TAU_STEPS = 200;
var LJ_MD_THERMOSTAT_CHI_SQUARE_MODE = "approx"; // "approx" is faster; "exact" samples dof - 1 Gaussians.
var LJ_MD_TEMPERATURE_SAMPLE_STEPS = 10;
var LJ_MD_PRESSURE_SAMPLE_STEPS = 10;
var LJ_MD_PRESSURE_BOX_THICKNESS_ANGSTROM = 10.0; // Converts the 2D box into a pseudo 3D volume for bar display.
var LJ_MD_COLOR_PERCENTILE_LOW = 0.2;
var LJ_MD_COLOR_PERCENTILE_HIGH = 0.9;
// Render radius is controlled only by each particle type's radiusPx. It does not change physics.
var LJ_MD_RESIZE_KICK_A_PER_PS = .005;
var LJ_MD_MAX_PARTICLE_KINETIC_DELTA_K = 1000;
var LJ_MD_MAX_TOTAL_FORCE_EV_PER_A = 50.0;
var LJ_MD_WALL_MODE = "reflective"; // "reflective" or "lj"
var LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM = 0.0;
var LJ_MD_WALL_SIGMA_SCALE = 0.75;
var LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM = 0.0; // 0 uses 2^(1/6) * wall sigma.
var LJ_MD_WALL_MAX_FORCE_EV_PER_A = 50.0;
var LJ_MD_MOUSE_WALL_ENABLED = true;
var LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM = 1.5;
var LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM = 6.0;
var LJ_MD_MOUSE_WALL_EPSILON_EV = 0.9;
var LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A = 100.0;
var LJ_MD_MOUSE_WALL_INITIAL_MODE = "repulsive"; // "repulsive" or "attractive".
var LJ_MD_PARTICLE_TYPES = [
  {
    name: "A",
    fraction: 0.80,
    massAmu: 8.0,
    sigmaAngstrom: 0.7,
    epsilonEv: 0.015,
    radiusPx: 3.0
  },
  {
    name: "B",
    fraction: 0.10,
    massAmu: 15.0,
    sigmaAngstrom: 1.5,
    epsilonEv: 0.11,
    radiusPx: 7.0
  },
  {
    name: "C",
    fraction: 0.03,
    massAmu: 40.0,
    sigmaAngstrom: 2.0,
    epsilonEv: 0.03,
    radiusPx: 8.0
  },
  {
    name: "D",
    fraction: 0.07,
    massAmu: 13.0,
    sigmaAngstrom: 0.7,
    epsilonEv: 0.08,
    radiusPx: 4.0
  }
];
// Pair tables follow the order above: A, B, C. Keep matrices symmetric.
// For "lj" pairs, equilibrium distance is r0 = 2^(1/6) * sigma.
// Set LJ_MD_PAIR_R0_ANGSTROM entries to control that final distance directly;
// null uses sigma mixing or LJ_MD_PAIR_SIGMA_ANGSTROM.
var LJ_MD_PAIR_R0_ANGSTROM = null;
// sigma controls interaction distance; epsilon controls attraction/repulsion strength.
var LJ_MD_PAIR_SIGMA_ANGSTROM = [
  [null,null,null,null], // A-A, A-B, A-C
  [null,null,null,null], // B-A, B-B, B-C
  [null,null,null,null],   // C-A, C-B, C-C
  [null,null,null,null],   // C-A, C-B, C-C
];
var LJ_MD_PAIR_EPSILON_EV = [
  [0.01,0.02,0.02,0.02], // A-A, A-B, A-C
  [0.02,null,null,null], // B-A, B-B, B-C
  [0.02,null,null,null],   // C-A, C-B, C-C
  [0.02,null,null,null],   // C-A, C-B, C-C
];
// "lj" = attractive + repulsive Lennard-Jones.
// "repulsive" = Weeks-Chandler-Andersen style: only the repulsive branch.
// Example: make A-B not attractive by setting [0][1] and [1][0] to "repulsive".
var LJ_MD_PAIR_MODE = [
  ["lj", "lj", "lj", "lj"],
  ["lj", "lj", "lj", "repulsive"],
  ["lj", "lj", "lj", "repulsive"],
  ["lj", "repulsive", "repulsive", "lj"],
];

var KB_EV_PER_K = 8.617333262145e-5;
var AMU_A2_PER_PS2_TO_EV = 1.0364269656262175e-4;
var EV_PER_A3_TO_BAR = 1602176.634;

var state = null;
var timerId = null;
var forceWorkers = [];
var forceWorkerBusy = false;

function randomNormal() {
  var u = 0;
  var v = 0;

  while (u === 0) {
    u = Math.random();
  }

  while (v === 0) {
    v = Math.random();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function chiSquare(degrees) {
  if (LJ_MD_THERMOSTAT_CHI_SQUARE_MODE === "approx" && degrees > 30) {
    var z = randomNormal();
    var a = 1 - 2 / (9 * degrees) + z * Math.sqrt(2 / (9 * degrees));

    return degrees * a * a * a;
  }

  var sum = 0;

  for (var i = 0; i < degrees; i += 1) {
    var r = randomNormal();
    sum += r * r;
  }

  return sum;
}

function boxFor(widthPx, heightPx, particleCount) {
  var aspect = widthPx / heightPx;
  var boxHeight = Math.sqrt(particleCount / (LJ_MD_DENSITY_2D * aspect));

  return {
    width: boxHeight * aspect,
    height: boxHeight
  };
}

function updateScale(sim) {
  sim.scale = Math.min(sim.widthPx / sim.boxWidth, sim.heightPx / sim.boxHeight);
  sim.offsetX = (sim.widthPx - sim.boxWidth * sim.scale) * 0.5;
  sim.offsetY = (sim.heightPx - sim.boxHeight * sim.scale) * 0.5;
}

function normalizeFractions(types) {
  var total = 0;

  for (var i = 0; i < types.length; i += 1) {
    total += Math.max(0, types[i].fraction || 0);
  }

  return total > 0 ? total : 1;
}

function assignTypes(sim) {
  var totalFraction = normalizeFractions(LJ_MD_PARTICLE_TYPES);
  var index = 0;

  for (var t = 0; t < LJ_MD_PARTICLE_TYPES.length; t += 1) {
    var count = t === LJ_MD_PARTICLE_TYPES.length - 1 ?
      sim.n - index :
      Math.round(sim.n * Math.max(0, LJ_MD_PARTICLE_TYPES[t].fraction || 0) / totalFraction);

    for (var i = 0; i < count && index < sim.n; i += 1) {
      sim.typeIds[index] = t;
      index += 1;
    }
  }

  for (var j = sim.n - 1; j > 0; j -= 1) {
    var swap = Math.floor(Math.random() * (j + 1));
    var tmp = sim.typeIds[j];
    sim.typeIds[j] = sim.typeIds[swap];
    sim.typeIds[swap] = tmp;
  }
}

function buildTypeTables(sim) {
  var typeCount = LJ_MD_PARTICLE_TYPES.length;

  sim.typeCount = typeCount;
  sim.typeMassFactors = new Float32Array(typeCount);
  sim.typeSigma = new Float32Array(typeCount);
  sim.typeEpsilon = new Float32Array(typeCount);
  sim.typeRadiusPx = new Float32Array(typeCount);
  sim.pairSigma = new Float32Array(typeCount * typeCount);
  sim.pairEpsilon = new Float32Array(typeCount * typeCount);
  sim.pairMode = new Int8Array(typeCount * typeCount);
  sim.pairSigma2 = new Float32Array(typeCount * typeCount);
  sim.pairCutoff2 = new Float32Array(typeCount * typeCount);
  sim.pairCoeff = new Float32Array(typeCount * typeCount);
  sim.maxPairCutoff = 0;

  for (var i = 0; i < typeCount; i += 1) {
    var type = LJ_MD_PARTICLE_TYPES[i];
    sim.typeMassFactors[i] = type.massAmu * AMU_A2_PER_PS2_TO_EV;
    sim.typeSigma[i] = type.sigmaAngstrom;
    sim.typeEpsilon[i] = type.epsilonEv;
    sim.typeRadiusPx[i] = type.radiusPx;
  }

  for (var a = 0; a < typeCount; a += 1) {
    for (var b = 0; b < typeCount; b += 1) {
      var p = a * typeCount + b;
      var sigmaOverride = LJ_MD_PAIR_SIGMA_ANGSTROM && LJ_MD_PAIR_SIGMA_ANGSTROM[a] ?
        LJ_MD_PAIR_SIGMA_ANGSTROM[a][b] :
        null;
      var r0Override = LJ_MD_PAIR_R0_ANGSTROM && LJ_MD_PAIR_R0_ANGSTROM[a] ?
        LJ_MD_PAIR_R0_ANGSTROM[a][b] :
        null;
      var epsilonOverride = LJ_MD_PAIR_EPSILON_EV && LJ_MD_PAIR_EPSILON_EV[a] ?
        LJ_MD_PAIR_EPSILON_EV[a][b] :
        null;

      sim.pairSigma[p] = r0Override == null ?
        (sigmaOverride == null ?
          0.5 * (sim.typeSigma[a] + sim.typeSigma[b]) :
          sigmaOverride) :
        r0Override / Math.pow(2, 1 / 6);
      sim.pairEpsilon[p] = epsilonOverride == null ?
        Math.sqrt(sim.typeEpsilon[a] * sim.typeEpsilon[b]) :
        epsilonOverride;
      sim.pairMode[p] = LJ_MD_PAIR_MODE && LJ_MD_PAIR_MODE[a][b] === "repulsive" ? 1 : 0;
      sim.pairSigma2[p] = sim.pairSigma[p] * sim.pairSigma[p];
      sim.pairCutoff2[p] = sim.pairMode[p] === 1 ?
        1.2599210498948732 * sim.pairSigma2[p] :
        6.25 * sim.pairSigma2[p];
      sim.pairCoeff[p] = 24 * sim.pairEpsilon[p] / sim.pairSigma2[p];
      sim.maxPairCutoff = Math.max(sim.maxPairCutoff, Math.sqrt(sim.pairCutoff2[p]));
    }
  }
}

function placeRandomParticles(sim) {
  var maxSigma = 0;

  for (var i = 0; i < sim.typeSigma.length; i += 1) {
    maxSigma = Math.max(maxSigma, sim.typeSigma[i]);
  }

  var minDistance = 0.86 * maxSigma;
  var minDistance2 = minDistance * minDistance;
  var margin = Math.pow(2, 1 / 6) * maxSigma;
  var placed = 0;
  var attempts = 0;
  var maxAttempts = sim.n * 350;

  while (placed < sim.n && attempts < maxAttempts) {
    attempts += 1;

    var x = margin + Math.random() * Math.max(maxSigma, sim.boxWidth - 2 * margin);
    var y = margin + Math.random() * Math.max(maxSigma, sim.boxHeight - 2 * margin);
    var ok = true;

    for (var j = 0; j < placed; j += 1) {
      var dx = x - sim.positions[2 * j];
      var dy = y - sim.positions[2 * j + 1];

      if (dx * dx + dy * dy < minDistance2) {
        ok = false;
        break;
      }
    }

    if (ok) {
      sim.positions[2 * placed] = x;
      sim.positions[2 * placed + 1] = y;
      placed += 1;
    }
  }

  while (placed < sim.n) {
    sim.positions[2 * placed] = margin + Math.random() * Math.max(maxSigma, sim.boxWidth - 2 * margin);
    sim.positions[2 * placed + 1] = margin + Math.random() * Math.max(maxSigma, sim.boxHeight - 2 * margin);
    placed += 1;
  }
}

function initializeVelocities(sim) {
  var sumVx = 0;
  var sumVy = 0;

  for (var i = 0; i < sim.n; i += 1) {
    var type = sim.typeIds[i];
    var std = Math.sqrt(KB_EV_PER_K * LJ_MD_INITIAL_TEMPERATURE_K / sim.typeMassFactors[type]);

    sim.velocitiesHalf[2 * i] = randomNormal() * std;
    sim.velocitiesHalf[2 * i + 1] = randomNormal() * std;
    sumVx += sim.velocitiesHalf[2 * i];
    sumVy += sim.velocitiesHalf[2 * i + 1];
  }

  sumVx /= sim.n;
  sumVy /= sim.n;

  for (var j = 0; j < sim.n; j += 1) {
    sim.velocitiesHalf[2 * j] -= sumVx;
    sim.velocitiesHalf[2 * j + 1] -= sumVy;
  }
}

function shouldUseParallel(particleCount) {
  if (LJ_MD_FORCE_MODE === "serial") {
    return false;
  }

  if (LJ_MD_FORCE_MODE === "parallel") {
    return LJ_MD_WORKER_COUNT > 1;
  }

  return LJ_MD_WORKER_COUNT > 1 && particleCount >= LJ_MD_PARALLEL_THRESHOLD;
}

function setupForceWorkers(sim) {
  forceWorkers.forEach(function(worker) {
    worker.terminate();
  });
  forceWorkers = [];

  if (!sim.useParallelForces) {
    return;
  }

  try {
    var forceWorkerFile = "lj-force-worker.js";

    if (LJ_MD_PARALLEL_FORCE_BACKEND === "approx") {
      forceWorkerFile = "lj-force-worker-approx.js";
    } else if (LJ_MD_PARALLEL_FORCE_BACKEND === "optimized") {
      forceWorkerFile = "lj-force-worker-optimized.js";
    }

    for (var i = 0; i < sim.workerCount; i += 1) {
      forceWorkers.push(new Worker(forceWorkerFile));
    }
  } catch (error) {
    forceWorkers.forEach(function(worker) {
      worker.terminate();
    });
    forceWorkers = [];
    sim.useParallelForces = false;
  }
}

function createState(width, height) {
  var box = boxFor(width, height, LJ_MD_PARTICLE_COUNT);
  var sim = {
    n: LJ_MD_PARTICLE_COUNT,
    widthPx: width,
    heightPx: height,
    boxWidth: box.width,
    boxHeight: box.height,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dt: LJ_MD_TIME_STEP_PS,
    tauPs: Math.max(LJ_MD_TIME_STEP_PS, LJ_MD_THERMOSTAT_TAU_STEPS * LJ_MD_TIME_STEP_PS),
    stepsPerFrame: LJ_MD_STEPS_PER_FRAME,
    targetFps: LJ_MD_TARGET_FPS,
    workerCount: Math.max(1, LJ_MD_WORKER_COUNT),
    useParallelForces: shouldUseParallel(LJ_MD_PARTICLE_COUNT),
    resizeKickAps: LJ_MD_RESIZE_KICK_A_PER_PS,
    stepCount: 0,
    sampleSerial: 0,
    temperatureK: LJ_MD_INITIAL_TEMPERATURE_K,
    targetTemperatureK: LJ_MD_INITIAL_TEMPERATURE_K,
    pressureBar: 0,
    virialEv: 0,
    potentialEnergyEv: 0,
    totalEnergyEv: 0,
    needPressure: false,
    needEnergy: false,
    cellHeads: null,
    cellNext: null,
    cellCapacity: 0,
    cellParticleCapacity: 0,
    colorMinEv: -KB_EV_PER_K * LJ_MD_INITIAL_TEMPERATURE_K * Math.log(1 - LJ_MD_COLOR_PERCENTILE_LOW),
    colorMaxEv: -KB_EV_PER_K * LJ_MD_INITIAL_TEMPERATURE_K * Math.log(1 - LJ_MD_COLOR_PERCENTILE_HIGH),
    mouseActive: false,
    mouseWallMode: LJ_MD_MOUSE_WALL_INITIAL_MODE === "attractive" ? "attractive" : "repulsive",
    mouseX: 0,
    mouseY: 0,
    positions: new Float32Array(LJ_MD_PARTICLE_COUNT * 2),
    velocitiesHalf: new Float32Array(LJ_MD_PARTICLE_COUNT * 2),
    forces: new Float32Array(LJ_MD_PARTICLE_COUNT * 2),
    typeIds: new Int16Array(LJ_MD_PARTICLE_COUNT)
  };

  buildTypeTables(sim);
  updateScale(sim);
  assignTypes(sim);
  placeRandomParticles(sim);
  initializeVelocities(sim);
  setupForceWorkers(sim);
  computeForcesSerial(sim);
  updateTemperatureScale(sim);

  return sim;
}

function chooseRandomType() {
  var totalFraction = normalizeFractions(LJ_MD_PARTICLE_TYPES);
  var target = Math.random() * totalFraction;
  var running = 0;

  for (var t = 0; t < LJ_MD_PARTICLE_TYPES.length; t += 1) {
    running += Math.max(0, LJ_MD_PARTICLE_TYPES[t].fraction || 0);

    if (target <= running) {
      return t;
    }
  }

  return Math.max(0, LJ_MD_PARTICLE_TYPES.length - 1);
}

function pairIndex(sim, i, j) {
  return sim.typeIds[i] * sim.typeCount + sim.typeIds[j];
}

function wallSigmaFor(sim, type) {
  return sim.typeSigma[type] * LJ_MD_WALL_SIGMA_SCALE;
}

function wallCutoffFor(sim, type) {
  if (LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM > 0) {
    return LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM;
  }

  return Math.pow(2, 1 / 6) * wallSigmaFor(sim, type);
}

function wallPaddingFor() {
  return LJ_MD_WALL_MODE === "reflective" ? LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM : 0;
}

function addWallForceTo(forces, sim, index, distance, sign, axis) {
  if (LJ_MD_WALL_MODE !== "lj") {
    return;
  }

  var type = sim.typeIds[index];
  var sigma = wallSigmaFor(sim, type);
  var epsilon = sim.typeEpsilon[type];
  var cutoff = wallCutoffFor(sim, type);

  if (distance >= cutoff) {
    return;
  }

  var d = Math.max(0.65 * sigma, distance);
  var sr = sigma / d;
  var sr2 = sr * sr;
  var sr6 = sr2 * sr2 * sr2;
  var sr12 = sr6 * sr6;
  var force = Math.min(LJ_MD_WALL_MAX_FORCE_EV_PER_A, 24 * epsilon * (2 * sr12 - sr6) / d);

  forces[2 * index + axis] += sign * force;
}

function addMouseWallForceTo(forces, sim, index, x, y) {
  if (!LJ_MD_MOUSE_WALL_ENABLED || !sim.mouseActive) {
    return;
  }

  var dx = x - sim.mouseX;
  var dy = y - sim.mouseY;
  var r = Math.sqrt(dx * dx + dy * dy);

  if (r <= 1e-9) {
    return;
  }

  var sigma = sim.typeSigma[sim.typeIds[index]];
  var coreRadius = LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM + 0.5 * sigma;
  var softness = Math.max(0.1, LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM);
  var influenceRadius = coreRadius + softness;

  if (r >= influenceRadius) {
    return;
  }

  var overlap = Math.max(0, influenceRadius - r) / softness;
  var coreBoost = r < coreRadius ? 1 + (coreRadius - r) / softness : 1;
  var force = 12 * LJ_MD_MOUSE_WALL_EPSILON_EV * overlap * overlap * coreBoost / softness;
  var direction = sim.mouseWallMode === "attractive" ? -1 : 1;

  force = Math.min(LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A, force);

  forces[2 * index] += direction * force * dx / r;
  forces[2 * index + 1] += direction * force * dy / r;
}

function capTotalForces(sim) {
  var maxForce2 = LJ_MD_MAX_TOTAL_FORCE_EV_PER_A * LJ_MD_MAX_TOTAL_FORCE_EV_PER_A;

  for (var i = 0; i < sim.n; i += 1) {
    var fx = sim.forces[2 * i];
    var fy = sim.forces[2 * i + 1];
    var f2 = fx * fx + fy * fy;

    if (f2 > maxForce2 && f2 > 0) {
      var scale = LJ_MD_MAX_TOTAL_FORCE_EV_PER_A / Math.sqrt(f2);
      sim.forces[2 * i] *= scale;
      sim.forces[2 * i + 1] *= scale;
    }
  }
}

function computeForcesSerial(sim) {
  if (LJ_MD_SERIAL_USE_CELL_LIST && sim.maxPairCutoff > 0) {
    computeForcesSerialCellList(sim);
    return;
  }

  var positions = sim.positions;
  var forces = sim.forces;
  var virial = 0;
  var potential = 0;

  forces.fill(0);

  for (var i = 0; i < sim.n; i += 1) {
    var ix = positions[2 * i];
    var iy = positions[2 * i + 1];

    for (var j = i + 1; j < sim.n; j += 1) {
      var dx = ix - positions[2 * j];
      var dy = iy - positions[2 * j + 1];
      var r2 = dx * dx + dy * dy;
      var p = pairIndex(sim, i, j);
      var sigma2 = sim.pairSigma2[p];

      if (r2 >= sim.pairCutoff2[p]) {
        continue;
      }

      r2 = Math.max(r2, 0.4225 * sigma2);

      var invU = sigma2 / r2;
      var invU3 = invU * invU * invU;
      var invU6 = invU3 * invU3;
      var scalar = sim.pairCoeff[p] * (2 * invU6 - invU3) * invU;
      var fx = scalar * dx;
      var fy = scalar * dy;

      forces[2 * i] += fx;
      forces[2 * i + 1] += fy;
      forces[2 * j] -= fx;
      forces[2 * j + 1] -= fy;

      if (sim.needPressure) {
        virial += dx * fx + dy * fy;
      }

      if (sim.needEnergy) {
        potential += 4 * sim.pairEpsilon[p] * (invU6 - invU3);
      }
    }

    addWallForceTo(forces, sim, i, ix, 1, 0);
    addWallForceTo(forces, sim, i, sim.boxWidth - ix, -1, 0);
    addWallForceTo(forces, sim, i, iy, 1, 1);
    addWallForceTo(forces, sim, i, sim.boxHeight - iy, -1, 1);
    addMouseWallForceTo(forces, sim, i, ix, iy);
  }

  capTotalForces(sim);
  sim.virialEv = sim.needPressure ? virial : 0;
  sim.potentialEnergyEv = sim.needEnergy ? potential : 0;
}

function addPairForce(sim, i, j, positions, forces, accum) {
  var dx = positions[2 * i] - positions[2 * j];
  var dy = positions[2 * i + 1] - positions[2 * j + 1];
  var r2 = dx * dx + dy * dy;
  var p = pairIndex(sim, i, j);
  var sigma2 = sim.pairSigma2[p];

  if (r2 >= sim.pairCutoff2[p]) {
    return;
  }

  r2 = Math.max(r2, 0.4225 * sigma2);

  var invU = sigma2 / r2;
  var invU3 = invU * invU * invU;
  var invU6 = invU3 * invU3;
  var scalar = sim.pairCoeff[p] * (2 * invU6 - invU3) * invU;
  var fx = scalar * dx;
  var fy = scalar * dy;

  forces[2 * i] += fx;
  forces[2 * i + 1] += fy;
  forces[2 * j] -= fx;
  forces[2 * j + 1] -= fy;

  if (sim.needPressure) {
    accum.virial += dx * fx + dy * fy;
  }

  if (sim.needEnergy) {
    accum.potential += 4 * sim.pairEpsilon[p] * (invU6 - invU3);
  }
}

function computeForcesSerialCellList(sim) {
  var positions = sim.positions;
  var forces = sim.forces;
  var cellSize = Math.max(1e-9, sim.maxPairCutoff);
  var cols = Math.max(1, Math.ceil(sim.boxWidth / cellSize));
  var rows = Math.max(1, Math.ceil(sim.boxHeight / cellSize));
  var cellCount = cols * rows;
  var heads;
  var next;
  var accum = {
    virial: 0,
    potential: 0
  };

  if (!sim.cellHeads || sim.cellCapacity < cellCount) {
    sim.cellHeads = new Int32Array(cellCount);
    sim.cellCapacity = cellCount;
  }

  if (!sim.cellNext || sim.cellParticleCapacity < sim.n) {
    sim.cellNext = new Int32Array(sim.n);
    sim.cellParticleCapacity = sim.n;
  }

  heads = sim.cellHeads;
  next = sim.cellNext;

  forces.fill(0);
  heads.fill(-1, 0, cellCount);

  for (var i = 0; i < sim.n; i += 1) {
    var x = positions[2 * i];
    var y = positions[2 * i + 1];
    var cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cellSize)));
    var cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cellSize)));
    var cell = cy * cols + cx;

    next[i] = heads[cell];
    heads[cell] = i;

    addWallForceTo(forces, sim, i, x, 1, 0);
    addWallForceTo(forces, sim, i, sim.boxWidth - x, -1, 0);
    addWallForceTo(forces, sim, i, y, 1, 1);
    addWallForceTo(forces, sim, i, sim.boxHeight - y, -1, 1);
    addMouseWallForceTo(forces, sim, i, x, y);
  }

  for (var row = 0; row < rows; row += 1) {
    for (var col = 0; col < cols; col += 1) {
      var baseCell = row * cols + col;

      for (var a = heads[baseCell]; a !== -1; a = next[a]) {
        for (var b = next[a]; b !== -1; b = next[b]) {
          addPairForce(sim, a, b, positions, forces, accum);
        }
      }

      for (var oy = 0; oy <= 1; oy += 1) {
        for (var ox = -1; ox <= 1; ox += 1) {
          if (oy === 0 && ox <= 0) {
            continue;
          }

          var nx = col + ox;
          var ny = row + oy;

          if (nx < 0 || nx >= cols || ny >= rows) {
            continue;
          }

          var otherCell = ny * cols + nx;

          for (var c = heads[baseCell]; c !== -1; c = next[c]) {
            for (var d = heads[otherCell]; d !== -1; d = next[d]) {
              addPairForce(sim, c, d, positions, forces, accum);
            }
          }
        }
      }
    }
  }

  capTotalForces(sim);
  sim.virialEv = sim.needPressure ? accum.virial : 0;
  sim.potentialEnergyEv = sim.needEnergy ? accum.potential : 0;
}

function computeForcesParallel(sim, done) {
  if (forceWorkerBusy || forceWorkers.length === 0) {
    computeForcesSerial(sim);
    done();
    return;
  }

  forceWorkerBusy = true;

  var completed = 0;
  var workers = forceWorkers.length;
  var chunk = Math.ceil(sim.n / workers);
  var totalForces = sim.forces;
  var totalVirial = 0;
  var totalPotential = 0;

  totalForces.fill(0);

  forceWorkers.forEach(function(worker, workerIndex) {
    var start = workerIndex * chunk;
    var end = Math.min(sim.n, start + chunk);
    var positionsSnapshot = sim.positions.slice();
    var typeIdsSnapshot = sim.typeIds.slice();
    var typeSigmaSnapshot = sim.typeSigma.slice();
    var typeEpsilonSnapshot = sim.typeEpsilon.slice();
    var pairSigmaSnapshot = sim.pairSigma.slice();
    var pairEpsilonSnapshot = sim.pairEpsilon.slice();
    var pairModeSnapshot = sim.pairMode.slice();

    worker.onmessage = function(event) {
      var partial = new Float32Array(event.data.forces);

      for (var i = 0; i < totalForces.length; i += 1) {
        totalForces[i] += partial[i];
      }

      if (sim.needPressure) {
        totalVirial += event.data.virialEv || 0;
      }

      if (sim.needEnergy) {
        totalPotential += event.data.potentialEnergyEv || 0;
      }
      completed += 1;

      if (completed === workers) {
        forceWorkerBusy = false;
        capTotalForces(sim);
        sim.virialEv = sim.needPressure ? totalVirial : 0;
        sim.potentialEnergyEv = sim.needEnergy ? totalPotential : 0;
        done();
      }
    };

    worker.onerror = function() {
      forceWorkerBusy = false;
      sim.useParallelForces = false;
      computeForcesSerial(sim);
      done();
    };

    worker.postMessage({
      positions: positionsSnapshot.buffer,
      typeIds: typeIdsSnapshot.buffer,
      n: sim.n,
      start: start,
      end: end,
      typeCount: sim.typeCount,
      typeSigma: typeSigmaSnapshot.buffer,
      typeEpsilon: typeEpsilonSnapshot.buffer,
      pairSigma: pairSigmaSnapshot.buffer,
      pairEpsilon: pairEpsilonSnapshot.buffer,
      pairMode: pairModeSnapshot.buffer,
      boxWidth: sim.boxWidth,
      boxHeight: sim.boxHeight,
      mouseActive: sim.mouseActive,
      mouseX: sim.mouseX,
      mouseY: sim.mouseY,
      mouseWallEnabled: LJ_MD_MOUSE_WALL_ENABLED,
      mouseWallRadius: LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM,
      mouseWallSoftness: LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM,
      mouseWallEpsilon: LJ_MD_MOUSE_WALL_EPSILON_EV,
      mouseWallMaxForce: LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A,
      mouseWallMode: sim.mouseWallMode,
      wallMode: LJ_MD_WALL_MODE,
      reflectiveWallPadding: LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM,
      wallSigmaScale: LJ_MD_WALL_SIGMA_SCALE,
      wallAppearanceDistance: LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM,
      wallMaxForce: LJ_MD_WALL_MAX_FORCE_EV_PER_A,
      needPressure: sim.needPressure,
      needEnergy: sim.needEnergy,
      approxTableBits: LJ_MD_APPROX_FORCE_TABLE_BITS
    }, [
      positionsSnapshot.buffer,
      typeIdsSnapshot.buffer,
      typeSigmaSnapshot.buffer,
      typeEpsilonSnapshot.buffer,
      pairSigmaSnapshot.buffer,
      pairEpsilonSnapshot.buffer,
      pairModeSnapshot.buffer
    ]);
  });
}

function computeForces(sim, done) {
  if (sim.useParallelForces) {
    computeForcesParallel(sim, done);
  } else {
    computeForcesSerial(sim);
    done();
  }
}

function integratePositions(sim) {
  var positions = sim.positions;
  var velocitiesHalf = sim.velocitiesHalf;
  var forces = sim.forces;

  for (var i = 0; i < sim.n; i += 1) {
    var type = sim.typeIds[i];

    velocitiesHalf[2 * i] += (forces[2 * i] / sim.typeMassFactors[type]) * sim.dt;
    velocitiesHalf[2 * i + 1] += (forces[2 * i + 1] / sim.typeMassFactors[type]) * sim.dt;
    positions[2 * i] += velocitiesHalf[2 * i] * sim.dt;
    positions[2 * i + 1] += velocitiesHalf[2 * i + 1] * sim.dt;

    clampInsideWall(sim, i);
  }
}

function kineticEnergy(sim) {
  var kinetic = 0;

  for (var i = 0; i < sim.n; i += 1) {
    var type = sim.typeIds[i];
    var vx = sim.velocitiesHalf[2 * i];
    var vy = sim.velocitiesHalf[2 * i + 1];

    kinetic += 0.5 * sim.typeMassFactors[type] * (vx * vx + vy * vy);
  }

  return kinetic;
}

function updatePressure(sim) {
  if (!sim.needPressure) {
    sim.pressureBar = 0;
    return;
  }

  var volumeA3 = Math.max(1e-9, sim.boxWidth * sim.boxHeight * LJ_MD_PRESSURE_BOX_THICKNESS_ANGSTROM);
  var idealEv = sim.n * KB_EV_PER_K * sim.temperatureK;
  var virialEv = 0.5 * (sim.virialEv || 0);

  sim.pressureBar = (idealEv + virialEv) / volumeA3 * EV_PER_A3_TO_BAR;
}

function updateTotalEnergy(sim, kinetic) {
  if (!sim.needEnergy) {
    sim.totalEnergyEv = 0;
    return;
  }

  sim.totalEnergyEv = kinetic + (sim.potentialEnergyEv || 0);
}

function clampInsideWall(sim, index) {
  var wallDistance = wallPaddingFor();
  var minX = Math.min(wallDistance, sim.boxWidth * 0.5);
  var maxX = Math.max(minX, sim.boxWidth - wallDistance);
  var minY = Math.min(wallDistance, sim.boxHeight * 0.5);
  var maxY = Math.max(minY, sim.boxHeight - wallDistance);

  if (sim.positions[2 * index] < minX) {
    sim.positions[2 * index] = minX;
    sim.velocitiesHalf[2 * index] = Math.abs(sim.velocitiesHalf[2 * index]);
  } else if (sim.positions[2 * index] > maxX) {
    sim.positions[2 * index] = maxX;
    sim.velocitiesHalf[2 * index] = -Math.abs(sim.velocitiesHalf[2 * index]);
  }

  if (sim.positions[2 * index + 1] < minY) {
    sim.positions[2 * index + 1] = minY;
    sim.velocitiesHalf[2 * index + 1] = Math.abs(sim.velocitiesHalf[2 * index + 1]);
  } else if (sim.positions[2 * index + 1] > maxY) {
    sim.positions[2 * index + 1] = maxY;
    sim.velocitiesHalf[2 * index + 1] = -Math.abs(sim.velocitiesHalf[2 * index + 1]);
  }
}

function capParticleKineticEnergy(sim) {
  var maxKineticEv = 1.5 * KB_EV_PER_K * (sim.temperatureK + LJ_MD_MAX_PARTICLE_KINETIC_DELTA_K);

  for (var i = 0; i < sim.n; i += 1) {
    var type = sim.typeIds[i];
    var vx = sim.velocitiesHalf[2 * i];
    var vy = sim.velocitiesHalf[2 * i + 1];
    var kinetic = 0.5 * sim.typeMassFactors[type] * (vx * vx + vy * vy);

    if (kinetic > maxKineticEv && kinetic > 0) {
      var scale = Math.sqrt(maxKineticEv / kinetic);
      sim.velocitiesHalf[2 * i] *= scale;
      sim.velocitiesHalf[2 * i + 1] *= scale;
    }
  }
}

function updateTemperatureScale(sim) {
  var dof = Math.max(1, 2 * sim.n - 2);
  var kinetic = kineticEnergy(sim);

  sim.sampleSerial += 1;
  sim.temperatureK = 2 * kinetic / (dof * KB_EV_PER_K);
  sim.colorMinEv = -KB_EV_PER_K * sim.temperatureK * Math.log(1 - LJ_MD_COLOR_PERCENTILE_LOW);
  sim.colorMaxEv = -KB_EV_PER_K * sim.temperatureK * Math.log(1 - LJ_MD_COLOR_PERCENTILE_HIGH);
  updatePressure(sim);
  updateTotalEnergy(sim, kinetic);
}

function applyVelocityRescaleThermostat(sim) {
  if (!LJ_MD_THERMOSTAT_ENABLED) {
    return;
  }

  var dof = Math.max(1, 2 * sim.n - 2);
  var kinetic = kineticEnergy(sim);

  if (kinetic <= 0) {
    return;
  }

  var targetKinetic = 0.5 * dof * KB_EV_PER_K * sim.targetTemperatureK;
  var c = Math.exp(-sim.dt / sim.tauPs);
  var r = randomNormal();
  var s = chiSquare(Math.max(1, dof - 1));
  var alpha2 = c +
    (1 - c) * targetKinetic * (s + r * r) / (kinetic * dof) +
    2 * r * Math.sqrt(c * (1 - c) * targetKinetic / (kinetic * dof));

  var alpha = Math.sqrt(Math.max(0.05, alpha2));

  for (var i = 0; i < sim.n; i += 1) {
    sim.velocitiesHalf[2 * i] *= alpha;
    sim.velocitiesHalf[2 * i + 1] *= alpha;
  }
}

function runMdStep(sim, remaining, done) {
  if (remaining <= 0) {
    done();
    return;
  }

  integratePositions(sim);
  applyVelocityRescaleThermostat(sim);
  capParticleKineticEnergy(sim);
  sim.stepCount += 1;

  if (sim.stepCount % LJ_MD_TEMPERATURE_SAMPLE_STEPS === 0) {
    updateTemperatureScale(sim);
  } else if (sim.stepCount % LJ_MD_PRESSURE_SAMPLE_STEPS === 0) {
    updatePressure(sim);
  }

  computeForces(sim, function() {
    runMdStep(sim, remaining - 1, done);
  });
}

function emitFrame(sim) {
  var positionsPx = new Float32Array(sim.n * 2);
  var kineticColors = new Float32Array(sim.n);
  var radii = new Float32Array(sim.n);
  var typeIds = sim.typeIds.slice();
  var denom = Math.max(1e-12, sim.colorMaxEv - sim.colorMinEv);

  for (var i = 0; i < sim.n; i += 1) {
    var type = sim.typeIds[i];
    var vx = sim.velocitiesHalf[2 * i];
    var vy = sim.velocitiesHalf[2 * i + 1];
    var ke = 0.5 * sim.typeMassFactors[type] * (vx * vx + vy * vy);

    positionsPx[2 * i] = sim.offsetX + sim.positions[2 * i] * sim.scale;
    positionsPx[2 * i + 1] = sim.offsetY + sim.positions[2 * i + 1] * sim.scale;
    kineticColors[i] = Math.max(0, Math.min(1, (ke - sim.colorMinEv) / denom));
    radii[i] = sim.typeRadiusPx[type];
  }

  self.postMessage({
    type: "frame",
    count: sim.n,
    positions: positionsPx.buffer,
    kineticColors: kineticColors.buffer,
    radii: radii.buffer,
    typeIds: typeIds.buffer,
    forceMode: sim.useParallelForces ? "parallel" : "serial",
    temperatureK: sim.temperatureK,
    pressureBar: sim.needPressure ? sim.pressureBar : null,
    totalEnergyEv: sim.needEnergy ? sim.totalEnergyEv : null,
    targetTemperatureK: sim.targetTemperatureK,
    sampleSerial: sim.sampleSerial,
    mouseWallMode: sim.mouseWallMode
  }, [positionsPx.buffer, kineticColors.buffer, radii.buffer, typeIds.buffer]);
}

function runFrame() {
  if (!state || forceWorkerBusy) {
    return;
  }

  runMdStep(state, state.stepsPerFrame, function() {
    emitFrame(state);
  });
}

function startTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
  }

  timerId = setInterval(runFrame, 1000 / state.targetFps);
}

function resizeTypedArraysForParticles(sim, newCount) {
  var newPositions = new Float32Array(newCount * 2);
  var newVelocities = new Float32Array(newCount * 2);
  var newForces = new Float32Array(newCount * 2);
  var newTypeIds = new Int16Array(newCount);

  newPositions.set(sim.positions);
  newVelocities.set(sim.velocitiesHalf);
  newForces.set(sim.forces);
  newTypeIds.set(sim.typeIds);

  sim.positions = newPositions;
  sim.velocitiesHalf = newVelocities;
  sim.forces = newForces;
  sim.typeIds = newTypeIds;
}

function initializeOneParticleAt(sim, index, x, y, type) {
  var margin = Math.pow(2, 1 / 6) * sim.typeSigma[type];
  var minX = Math.min(margin, sim.boxWidth * 0.5);
  var maxX = Math.max(minX, sim.boxWidth - margin);
  var minY = Math.min(margin, sim.boxHeight * 0.5);
  var maxY = Math.max(minY, sim.boxHeight - margin);
  var std = Math.sqrt(KB_EV_PER_K * LJ_MD_INITIAL_TEMPERATURE_K / sim.typeMassFactors[type]);

  sim.positions[2 * index] = Math.max(minX, Math.min(maxX, x));
  sim.positions[2 * index + 1] = Math.max(minY, Math.min(maxY, y));
  sim.velocitiesHalf[2 * index] = randomNormal() * std;
  sim.velocitiesHalf[2 * index + 1] = randomNormal() * std;
  sim.forces[2 * index] = 0;
  sim.forces[2 * index + 1] = 0;
  sim.typeIds[index] = type;
}

function positionHasRoom(sim, candidateX, candidateY, upto, type) {
  var minDistance = 0.82 * sim.typeSigma[type];
  var minDistance2 = minDistance * minDistance;

  for (var i = 0; i < upto; i += 1) {
    var dx = candidateX - sim.positions[2 * i];
    var dy = candidateY - sim.positions[2 * i + 1];

    if (dx * dx + dy * dy < minDistance2) {
      return false;
    }
  }

  return true;
}

function addParticlesNear(sim, xPx, yPx) {
  if (forceWorkerBusy) {
    return;
  }

  var requested = Math.max(0, LJ_MD_CLICK_ADD_PARTICLE_COUNT | 0);
  var addCount = Math.min(requested, Math.max(0, LJ_MD_MAX_PARTICLE_COUNT - sim.n));

  if (addCount <= 0) {
    return;
  }

  var oldCount = sim.n;
  var newCount = oldCount + addCount;
  var centerX = (xPx - sim.offsetX) / sim.scale;
  var centerY = (yPx - sim.offsetY) / sim.scale;
  var oldParallel = sim.useParallelForces;

  resizeTypedArraysForParticles(sim, newCount);
  sim.n = newCount;

  for (var i = oldCount; i < newCount; i += 1) {
    var type = chooseRandomType();
    var placed = false;
    var spread = Math.max(1.5, LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM + LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM);

    for (var attempt = 0; attempt < 80; attempt += 1) {
      var angle = Math.random() * Math.PI * 2;
      var radius = Math.sqrt(Math.random()) * spread;
      var x = centerX + Math.cos(angle) * radius;
      var y = centerY + Math.sin(angle) * radius;

      if (positionHasRoom(sim, x, y, i, type)) {
        initializeOneParticleAt(sim, i, x, y, type);
        placed = true;
        break;
      }
    }

    if (!placed) {
      initializeOneParticleAt(sim, i, centerX, centerY, type);
    }
  }

  sim.useParallelForces = shouldUseParallel(sim.n);

  if (sim.useParallelForces !== oldParallel) {
    setupForceWorkers(sim);
  }

  updateTemperatureScale(sim);
  computeForces(sim, function() {});
}

function handleResize(sim, width, height) {
  var oldBoxWidth = sim.boxWidth;
  var oldBoxHeight = sim.boxHeight;
  var box = boxFor(width, height, sim.n);
  var vxWall = (box.width - oldBoxWidth) / Math.max(sim.dt, 1e-9);
  var vyWall = (box.height - oldBoxHeight) / Math.max(sim.dt, 1e-9);

  sim.widthPx = width;
  sim.heightPx = height;
  sim.boxWidth = box.width;
  sim.boxHeight = box.height;
  updateScale(sim);

  for (var i = 0; i < sim.n; i += 1) {
    var wallDistance = wallPaddingFor();
    var maxX = Math.max(Math.min(wallDistance, sim.boxWidth * 0.5), sim.boxWidth - wallDistance);
    var maxY = Math.max(Math.min(wallDistance, sim.boxHeight * 0.5), sim.boxHeight - wallDistance);

    if (sim.positions[2 * i] > maxX) {
      sim.positions[2 * i] = maxX;
      sim.velocitiesHalf[2 * i] = -Math.abs(sim.velocitiesHalf[2 * i]) - Math.min(sim.resizeKickAps, Math.abs(vxWall) * 0.02);
    }

    if (sim.positions[2 * i + 1] > maxY) {
      sim.positions[2 * i + 1] = maxY;
      sim.velocitiesHalf[2 * i + 1] = -Math.abs(sim.velocitiesHalf[2 * i + 1]) - Math.min(sim.resizeKickAps, Math.abs(vyWall) * 0.02);
    }

    clampInsideWall(sim, i);
  }

  capParticleKineticEnergy(sim);
  computeForces(sim, function() {});
}

self.onmessage = function(event) {
  var data = event.data;

  if (data.type === "resize" && state) {
    handleResize(state, data.width, data.height);
  }

  if (data.type === "mouse" && state) {
    state.mouseActive = data.active;

    if (data.active) {
      state.mouseX = (data.x - state.offsetX) / state.scale;
      state.mouseY = (data.y - state.offsetY) / state.scale;
    }
  }

  if (data.type === "addParticles" && state) {
    addParticlesNear(state, data.x, data.y);
  }

  if (data.type === "toggleMouseWall" && state) {
    state.mouseWallMode = state.mouseWallMode === "attractive" ? "repulsive" : "attractive";
    state.mouseActive = true;
    state.mouseX = (data.x - state.offsetX) / state.scale;
    state.mouseY = (data.y - state.offsetY) / state.scale;
  }

  if (data.type === "adjustTemperature" && state) {
    state.targetTemperatureK = Math.max(1, state.targetTemperatureK + data.deltaK);
  }

  if (data.type === "diagnostics" && state) {
    state.needPressure = !!data.pressure;
    state.needEnergy = !!data.energy;
    updateTemperatureScale(state);
  }

  if (data.type === "start") {
    state = createState(data.width || 1200, data.height || 800);
    startTimer();
  }
};
