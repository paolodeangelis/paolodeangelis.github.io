function addWallForce(forces, index, distance, sign, axis, type, typeSigma, typeEpsilon, data) {
  if (data.wallMode !== "lj") {
    return;
  }

  var sigma = typeSigma[type] * data.wallSigmaScale;
  var epsilon = typeEpsilon[type];
  var cutoff = data.wallAppearanceDistance > 0 ?
    data.wallAppearanceDistance :
    Math.pow(2, 1 / 6) * sigma;

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
  var r = Math.sqrt(dx * dx + dy * dy);

  if (r <= 1e-9) {
    return;
  }

  var sigma = typeSigma[type];
  var coreRadius = data.mouseWallRadius + 0.5 * sigma;
  var softness = Math.max(0.1, data.mouseWallSoftness);
  var influenceRadius = coreRadius + softness;

  if (r >= influenceRadius) {
    return;
  }

  var overlap = Math.max(0, influenceRadius - r) / softness;
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
  var pairSigma = new Float32Array(data.pairSigma);
  var pairEpsilon = new Float32Array(data.pairEpsilon);
  var pairMode = new Int8Array(data.pairMode);
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
      var sigma = pairSigma[pair];
      var epsilon = pairEpsilon[pair];
      var cutoff = pairMode[pair] === 1 ? 1.122462048309373 * sigma : 2.5 * sigma;

      if (r2 >= cutoff * cutoff) {
        continue;
      }

      r2 = Math.max(r2, 0.4225 * sigma * sigma);

      var invR2 = sigma * sigma / r2;
      var invR6 = invR2 * invR2 * invR2;
      var invR12 = invR6 * invR6;
      var scalar = 24 * epsilon * (2 * invR12 - invR6) / r2;
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
        potential += 4 * epsilon * (invR12 - invR6);
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
