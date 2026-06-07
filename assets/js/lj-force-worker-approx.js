var tableCache = Object.create(null);

function cacheKey(data) {
  var key = [
    data.typeCount,
    data.approxTableBits,
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

function buildTables(data) {
  var key = cacheKey(data);

  if (tableCache[key]) {
    return tableCache[key];
  }

  var typeCount = data.typeCount;
  var tableBits = Math.max(5, Math.min(12, data.approxTableBits || 9));
  var tableSize = 1 << tableBits;
  var pairSigma = new Float32Array(data.pairSigma);
  var pairEpsilon = new Float32Array(data.pairEpsilon);
  var pairMode = new Int8Array(data.pairMode);
  var scalarTables = new Array(typeCount * typeCount);
  var minU = 0.4225;
  var maxU = 6.25;
  var uStep = (maxU - minU) / (tableSize - 1);

  for (var p = 0; p < scalarTables.length; p += 1) {
    var table = new Float32Array(tableSize);
    var sigma = pairSigma[p];
    var epsilon = pairEpsilon[p];
    var invSigma2 = 1 / (sigma * sigma);
    var maxPairU = pairMode[p] === 1 ? 1.2599210498948732 : maxU;

    for (var i = 0; i < tableSize; i += 1) {
      var u = minU + i * uStep;
      if (u > maxPairU) {
        table[i] = 0;
        continue;
      }
      var invU = 1 / u;
      var invU3 = invU * invU * invU;
      var invU6 = invU3 * invU3;

      table[i] = 24 * epsilon * (2 * invU6 - invU3) * invU * invSigma2;
    }

    scalarTables[p] = table;
  }

    tableCache[key] = {
    scalarTables: scalarTables,
    pairEpsilon: pairEpsilon,
    tableSize: tableSize,
    tableMask: tableSize - 1,
    minU: minU,
    maxU: maxU,
    invRange: 1 / (maxU - minU)
  };

  return tableCache[key];
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
  var pairSigma = new Float32Array(data.pairSigma);
  var pairMode = new Int8Array(data.pairMode);
  var tables = buildTables(data);
  var forces = new Float32Array(data.n * 2);
  var tableMax = tables.tableSize - 1;
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
      var sigma2 = sigma * sigma;
      var cutoff2 = pairMode[pair] === 1 ? 1.2599210498948732 * sigma2 : 6.25 * sigma2;

      if (r2 >= cutoff2) {
        continue;
      }

      var u = r2 / sigma2;
      if (u < tables.minU) {
        u = tables.minU;
      }

      var bin = ((u - tables.minU) * tables.invRange * tableMax) | 0;
      if (bin < 0) {
        bin = 0;
      } else if (bin > tableMax) {
        bin = tableMax;
      }

      var scalar = tables.scalarTables[pair][bin];
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
        var invUForEnergy = 1 / u;
        var invU3ForEnergy = invUForEnergy * invUForEnergy * invUForEnergy;
        var invU6ForEnergy = invU3ForEnergy * invU3ForEnergy;
        potential += 4 * tables.pairEpsilon[pair] * (invU6ForEnergy - invU3ForEnergy);
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
