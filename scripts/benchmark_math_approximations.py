#!/usr/bin/env python3
"""Benchmark JS math/force approximations used by the LJ homepage animation.

The script generates a temporary Node.js benchmark and compares:
- native sqrt / inverse sqrt vs classic bit-hack inverse sqrt;
- exact LJ force worker vs lookup-table approximate force worker;
- single-worker and multi-worker force execution.
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path


FAST_INV_SQRT_MAGIC = "0x5f3759df"


NODE_BENCHMARK = f"""
const fs = require("fs");
const path = require("path");
const {{ Worker }} = require("worker_threads");
const {{ performance }} = require("perf_hooks");

const repoRoot = process.cwd();
const exactWorkerPath = path.join(repoRoot, "assets/js/lj-force-worker.js");
const approxWorkerPath = path.join(repoRoot, "assets/js/lj-force-worker-approx.js");
const mdWorkerSource = fs.readFileSync(path.join(repoRoot, "assets/js/lj-md-worker.js"), "utf8");

const N_SQRT = 5_000_000;
const xs = new Float32Array(N_SQRT);
for (let i = 0; i < N_SQRT; i += 1) {{
  xs[i] = 0.001 + (i % 10000) / 1000;
}}

const buffer = new ArrayBuffer(4);
const f32 = new Float32Array(buffer);
const i32 = new Int32Array(buffer);

function fastInvSqrt(x) {{
  const xhalf = 0.5 * x;
  f32[0] = x;
  i32[0] = {FAST_INV_SQRT_MAGIC} - (i32[0] >> 1);
  let y = f32[0];
  y = y * (1.5 - xhalf * y * y);
  return y;
}}

function benchMath(name, fn) {{
  let checksum = 0;
  const t0 = performance.now();
  for (let i = 0; i < N_SQRT; i += 1) checksum += fn(xs[i]);
  const t1 = performance.now();
  console.log(`${{name}}: ${{(t1 - t0).toFixed(2)}} ms checksum=${{checksum.toFixed(4)}}`);
}}

function getConstant(name, fallback) {{
  const re = new RegExp(`var ${{name}} = ([^;]+);`);
  const match = mdWorkerSource.match(re);
  if (!match) return fallback;
  return Function(`return (${{match[1]}});`)();
}}

const particleTypes = Function(`
  const self = {{ postMessage() {{}} }};
  const setInterval = () => 0;
  const clearInterval = () => {{}};
  ${{mdWorkerSource}};
  return LJ_MD_PARTICLE_TYPES;
`)();
const particleCount = getConstant("LJ_MD_PARTICLE_COUNT", 200);
const tableBits = getConstant("LJ_MD_APPROX_FORCE_TABLE_BITS", 9);

function makeSnapshot(n) {{
  const width = 70;
  const height = 45;
  const positions = new Float32Array(n * 2);
  const typeIds = new Int16Array(n);
  const typeCount = particleTypes.length;
  const typeSigma = new Float32Array(typeCount);
  const typeEpsilon = new Float32Array(typeCount);
  const pairSigma = new Float32Array(typeCount * typeCount);
  const pairEpsilon = new Float32Array(typeCount * typeCount);
  const pairMode = new Int8Array(typeCount * typeCount);

  for (let t = 0; t < typeCount; t += 1) {{
    typeSigma[t] = particleTypes[t].sigmaAngstrom;
    typeEpsilon[t] = particleTypes[t].epsilonEv;
  }}

  for (let a = 0; a < typeCount; a += 1) {{
    for (let b = 0; b < typeCount; b += 1) {{
      const p = a * typeCount + b;
      pairSigma[p] = 0.5 * (typeSigma[a] + typeSigma[b]);
      pairEpsilon[p] = Math.sqrt(typeEpsilon[a] * typeEpsilon[b]);
    }}
  }}

  let totalFraction = 0;
  for (const type of particleTypes) totalFraction += Math.max(0, type.fraction || 0);
  let idx = 0;
  for (let t = 0; t < typeCount; t += 1) {{
    const count = t === typeCount - 1 ? n - idx : Math.round(n * Math.max(0, particleTypes[t].fraction || 0) / totalFraction);
    for (let k = 0; k < count && idx < n; k += 1) typeIds[idx++] = t;
  }}

  const cols = Math.ceil(Math.sqrt(n * width / height));
  for (let i = 0; i < n; i += 1) {{
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[2 * i] = 1 + (col + 0.37) * (width - 2) / cols;
    positions[2 * i + 1] = 1 + (row + 0.61) * (height - 2) / Math.ceil(n / cols);
  }}

  return {{
    positions,
    typeIds,
    n,
    typeCount,
    typeSigma,
    typeEpsilon,
    pairSigma,
    pairEpsilon,
    pairMode,
    boxWidth: width,
    boxHeight: height,
    mouseActive: true,
    mouseX: width * 0.53,
    mouseY: height * 0.47,
    mouseWallEnabled: true,
    mouseWallRadius: getConstant("LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM", 2.2),
    mouseWallSoftness: getConstant("LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM", 6.0),
    mouseWallEpsilon: getConstant("LJ_MD_MOUSE_WALL_EPSILON_EV", 0.15),
    mouseWallMaxForce: getConstant("LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A", 0.3),
    wallMode: getConstant("LJ_MD_WALL_MODE", "reflective"),
    reflectiveWallPadding: getConstant("LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM", 0),
    wallSigmaScale: getConstant("LJ_MD_WALL_SIGMA_SCALE", 0.75),
    wallAppearanceDistance: getConstant("LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM", 0),
    wallMaxForce: getConstant("LJ_MD_WALL_MAX_FORCE_EV_PER_A", 0.9),
    approxTableBits: tableBits
  }};
}}

function cloneTask(base, start, end) {{
  return {{
    positions: base.positions.slice().buffer,
    typeIds: base.typeIds.slice().buffer,
    n: base.n,
    start,
    end,
    typeCount: base.typeCount,
    typeSigma: base.typeSigma.slice().buffer,
    typeEpsilon: base.typeEpsilon.slice().buffer,
    pairSigma: base.pairSigma.slice().buffer,
    pairEpsilon: base.pairEpsilon.slice().buffer,
    pairMode: base.pairMode.slice().buffer,
    boxWidth: base.boxWidth,
    boxHeight: base.boxHeight,
    mouseActive: base.mouseActive,
    mouseX: base.mouseX,
    mouseY: base.mouseY,
    mouseWallEnabled: base.mouseWallEnabled,
    mouseWallRadius: base.mouseWallRadius,
    mouseWallSoftness: base.mouseWallSoftness,
    mouseWallEpsilon: base.mouseWallEpsilon,
    mouseWallMaxForce: base.mouseWallMaxForce,
    wallMode: base.wallMode,
    reflectiveWallPadding: base.reflectiveWallPadding,
    wallSigmaScale: base.wallSigmaScale,
    wallAppearanceDistance: base.wallAppearanceDistance,
    wallMaxForce: base.wallMaxForce,
    approxTableBits: base.approxTableBits
  }};
}}

function workerSource(filePath) {{
  const source = fs.readFileSync(filePath, "utf8");
  return `
    const {{ parentPort }} = require("worker_threads");
    global.self = {{
      postMessage(message, transferList) {{ parentPort.postMessage(message, transferList); }}
    }};
    ${{source}}
    parentPort.on("message", message => global.self.onmessage({{ data: message }}));
  `;
}}

async function runWorkerPool(filePath, workerCount, iterations, base) {{
  const source = workerSource(filePath);
  const workers = Array.from({{ length: workerCount }}, () => new Worker(source, {{ eval: true }}));
  const chunk = Math.ceil(base.n / workerCount);

  // Warm cache/JIT.
  await Promise.all(workers.map((worker, i) => new Promise(resolve => {{
    worker.once("message", resolve);
    worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
  }})));

  const t0 = performance.now();
  for (let iter = 0; iter < iterations; iter += 1) {{
    await Promise.all(workers.map((worker, i) => new Promise(resolve => {{
      worker.once("message", resolve);
      worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
    }})));
  }}
  const t1 = performance.now();

  await Promise.all(workers.map(worker => worker.terminate()));
  return (t1 - t0) / iterations;
}}

async function main() {{
  console.log(`FAST_INV_SQRT_MAGIC = {FAST_INV_SQRT_MAGIC}`);
  console.log("FAST_INV_SQRT_NEWTON = y * (1.5 - 0.5 * x * y * y)");
  benchMath("1 / Math.sqrt", x => 1 / Math.sqrt(x));
  benchMath("fastInvSqrt bit hack", x => fastInvSqrt(x));
  benchMath("Math.sqrt", x => Math.sqrt(x));

  const base = makeSnapshot(particleCount);
  const iterations = 80;
  const exact1 = await runWorkerPool(exactWorkerPath, 1, iterations, base);
  const approx1 = await runWorkerPool(approxWorkerPath, 1, iterations, base);
  const exact4 = await runWorkerPool(exactWorkerPath, 4, iterations, base);
  const approx4 = await runWorkerPool(approxWorkerPath, 4, iterations, base);

  function report(label, exact, approx) {{
    const gain = exact / approx;
    console.log(`${{label}} exact:  ${{exact.toFixed(3)}} ms/force`);
    console.log(`${{label}} approx: ${{approx.toFixed(3)}} ms/force`);
    console.log(`${{label}} speed gain: ${{gain.toFixed(2)}}x`);
  }}

  console.log(`force benchmark particleCount=${{particleCount}} iterations=${{iterations}}`);
  report("1 worker", exact1, approx1);
  report("4 worker", exact4, approx4);
}}

main().catch(error => {{
  console.error(error);
  process.exitCode = 1;
}});
"""


def main() -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        benchmark_path = Path(tmpdir) / "bench_math_approximations.js"
        benchmark_path.write_text(NODE_BENCHMARK, encoding="utf-8")
        completed = subprocess.run(["node", str(benchmark_path)], check=False)

    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
