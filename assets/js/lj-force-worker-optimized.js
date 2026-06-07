var constantsCache = Object.create(null);

function cacheKey(data) {
  var key = [
    data.typeCount,
    data.wallMode,
    data.wallSigmaScale,
    data.wallAppearanceDistance,
    data.wallMaxForce,
    data.mouseWallRadius,
    data.mouseWallSoftness,
    data.mouseWallEpsilon,
    data.mouseWallMaxForce,
    data.mouseWallMode
  ];
  var pairSigma = new Float32Array(data.pairSigma);
  var pairEpsilon = new Float32Array(data.pairEpsilon);
  var pairMode = new Int8Array(data.pairMode);

  for (var i = 0; i < pairSigma.length; i += 1) {
    key.push(pairSigma[i], pairEpsilon[i], pairMode[i]);
  }

  return key.join("|");
}

function buildConstants(data) {
  var key = cacheKey(data);

  if (constantsCache[key]) {
    return constantsCache[key];
  }

  var pairSigma = new Float32Array(data.pairSigma);
  var pairEpsilon = new Float32Array(data.pairEpsilon);
  var pairMode = new Int8Array(data.pairMode);
  var count = pairSigma.length;
  var sigma2 = new Float32Array(count);
  var cutoff2 = new Float32Array(count);
  var invSigma2 = new Float32Array(count);
  var coeff = new Float32Array(count);

  for (var i = 0; i < count; i += 1) {
    sigma2[i] = pairSigma[i] * pairSigma[i];
    cutoff2[i] = pairMode[i] === 1 ? 1.2599210498948732 * sigma2[i] : 6.25 * sigma2[i];
    invSigma2[i] = 1 / sigma2[i];
    coeff[i] = 24 * pairEpsilon[i] * invSigma2[i];
  }

  constantsCache[key] = {
    sigma2: sigma2,
    cutoff2: cutoff2,
    invSigma2: invSigma2,
    coeff: coeff,
    epsilon: pairEpsilon
  };

  return constantsCache[key];
}

function addWallForce(forces, index, distance, sign, axis, type, typeSigma, typeEpsilon, data) {
  if (data.wallMode !== "lj") {
    return;
  }

  var sigma = typeSigma[type] * data.wallSigmaScale;
  var epsilon = typeEpsilon[type];
  var cutoff = data.wallAppearanceDistance > 0 ?
    data.wallAppearanceDistance :
    1.122462048309373 * sigma;

  if (distance >= cutoff) {
    return;
  }

  var d = Math.max(0.65 * sigma, distance);
  var sr = sigma / d;
  var sr2 = sr * sr;
  var sr6 = sr2 * sr2 * sr2;
  var sr12 = sr6 * sr6;
  var force = Math.min(data.wallMaxForce, 24 * epsilon * (2 * sr12 - sr6) / d);

  forces[2 * index + axis] += sign * force;
}

function addMouseWallForce(forces, index, x, y, type, typeSigma, data) {
  if (!data.mouseWallEnabled || !data.mouseActive) {
    return;
  }

  var dx = x - data.mouseX;
  var dy = y - data.mouseY;
  var r2 = dx * dx + dy * dy;

  if (r2 <= 1e-18) {
    return;
  }

  var r = Math.sqrt(r2);
  var sigma = typeSigma[type];
  var coreRadius = data.mouseWallRadius + 0.5 * sigma;
  var softness = Math.max(0.1, data.mouseWallSoftness);
  var influenceRadius = coreRadius + softness;

  if (r >= influenceRadius) {
    return;
  }

  var overlap = (influenceRadius - r) / softness;
  var coreBoost = r < coreRadius ? 1 + (coreRadius - r) / softness : 1;
  var force = 12 * data.mouseWallEpsilon * overlap * overlap * coreBoost / softness;
  var direction = data.mouseWallMode === "attractive" ? -1 : 1;

  force = Math.min(data.mouseWallMaxForce, force);

  forces[2 * index] += direction * force * dx / r;
  forces[2 * index + 1] += direction * force * dy / r;
}

self.onmessage = function(event) {
  var data = event.data;
  var positions = new Float32Array(data.positions);
  var typeIds = new Int16Array(data.typeIds);
  var typeSigma = new Float32Array(data.typeSigma);
  var typeEpsilon = new Float32Array(data.typeEpsilon);
  var constants = buildConstants(data);
  var forces = new Float32Array(data.n * 2);
  var virial = 0;
  var potential = 0;

  for (var i = data.start; i < data.end; i += 1) {
    var ix = positions[2 * i];
    var iy = positions[2 * i + 1];
    var typeI = typeIds[i];

    for (var j = i + 1; j < data.n; j += 1) {
      var dx = ix - positions[2 * j];
      var dy = iy - positions[2 * j + 1];
      var r2 = dx * dx + dy * dy;
      var pair = typeI * data.typeCount + typeIds[j];

      if (r2 >= constants.cutoff2[pair]) {
        continue;
      }

      r2 = Math.max(r2, 0.4225 * constants.sigma2[pair]);

      var invU = constants.sigma2[pair] / r2;
      var invU3 = invU * invU * invU;
      var invU6 = invU3 * invU3;
      var scalar = constants.coeff[pair] * (2 * invU6 - invU3) * invU;
      var fx = scalar * dx;
      var fy = scalar * dy;

      forces[2 * i] += fx;
      forces[2 * i + 1] += fy;
      forces[2 * j] -= fx;
      forces[2 * j + 1] -= fy;

      if (data.needPressure) {
        virial += dx * fx + dy * fy;
      }

      if (data.needEnergy) {
        potential += 4 * constants.epsilon[pair] * (invU6 - invU3);
      }
    }

    addWallForce(forces, i, ix, 1, 0, typeI, typeSigma, typeEpsilon, data);
    addWallForce(forces, i, data.boxWidth - ix, -1, 0, typeI, typeSigma, typeEpsilon, data);
    addWallForce(forces, i, iy, 1, 1, typeI, typeSigma, typeEpsilon, data);
    addWallForce(forces, i, data.boxHeight - iy, -1, 1, typeI, typeSigma, typeEpsilon, data);
    addMouseWallForce(forces, i, ix, iy, typeI, typeSigma, data);
  }

  self.postMessage({
    forces: forces.buffer,
    virialEv: data.needPressure ? virial : 0,
    potentialEnergyEv: data.needEnergy ? potential : 0
  }, [forces.buffer]);
};
