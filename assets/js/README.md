# JavaScript Assets

This directory contains the browser scripts used by the site. The most complex part is the homepage Lennard-Jones molecular dynamics animation.

## Homepage LJ MD Animation

Main files:

- `main.js`: browser-side rendering, mouse/keyboard controls, HUD, graph display, and fallback startup.
- `lj-md-worker.js`: simulation state, integration, thermostat, resize logic, particle insertion, diagnostics, and serial force evaluation.
- `lj-force-worker.js`: exact parallel force worker.
- `lj-force-worker-optimized.js`: optimized exact parallel force worker.
- `lj-force-worker-approx.js`: approximate lookup-table force worker.
- `particles.min.js`: old/fallback particle animation library.

## Where To Change Parameters

Physics and simulation parameters are at the top of `lj-md-worker.js`.

Common parameters:

- `LJ_MD_PARTICLE_COUNT`: initial number of particles.
- `LJ_MD_CLICK_ADD_PARTICLE_COUNT`: number of particles added per left click.
- `LJ_MD_MAX_PARTICLE_COUNT`: hard limit after repeated clicks.
- `LJ_MD_INITIAL_TEMPERATURE_K`: initial and default thermostat target temperature.
- `LJ_MD_TIME_STEP_PS`: integration timestep.
- `LJ_MD_DENSITY_2D`: controls simulation box size for a given particle count.
- `LJ_MD_THERMOSTAT_TAU_STEPS`: thermostat coupling time in timesteps.
- `LJ_MD_PARALLEL_THRESHOLD`: particle count where auto mode may switch to force workers.
- `LJ_MD_WORKER_COUNT`: number of force workers when parallel mode is active.
- `LJ_MD_SERIAL_USE_CELL_LIST`: enables the serial neighbor-cell force path.

Particle types are defined in `LJ_MD_PARTICLE_TYPES`.

Important fields:

- `name`: type label.
- `fraction`: initial composition.
- `massAmu`: particle mass in atomic mass units.
- `sigmaAngstrom`: LJ size parameter.
- `epsilonEv`: LJ well depth.
- `radiusPx`: visual radius in screen pixels. This does not affect physics.

Pair interaction tables:

- `LJ_MD_PAIR_R0_ANGSTROM`: optional direct equilibrium distance table for LJ pairs.
- `LJ_MD_PAIR_SIGMA_ANGSTROM`: optional pair sigma override.
- `LJ_MD_PAIR_EPSILON_EV`: optional pair epsilon override.
- `LJ_MD_PAIR_MODE`: `"lj"` for attractive + repulsive, `"repulsive"` for WCA-style repulsion only.

Use `null` in pair tables to compute values from particle types.

## Rendering And HUD

Display/HUD parameters are at the top of `main.js`.

Common parameters:

- `LJ_MD_RENDER_COLOR_MODE`: `"type"` or `"kinetic"`.
- `LJ_MD_PARTICLE_ALPHA_MIN`: minimum particle opacity.
- `LJ_MD_PARTICLE_ALPHA_MAX`: maximum particle opacity.
- `LJ_MD_SHOW_TEMPERATURE`: initial temperature HUD visibility.
- `LJ_MD_SHOW_PRESSURE`: initial pressure HUD visibility.
- `LJ_MD_SHOW_ENERGY`: initial total energy HUD visibility.
- `LJ_MD_SHOW_PARTICLE_COUNT`: initial particle count HUD visibility.
- `LJ_MD_GRAPH_HISTORY_LIMIT`: number of samples kept in graph FIFO history.
- `LJ_MD_HUD_BACKGROUND_ALPHA`: HUD background opacity.
- `LJ_MD_TYPE_COLORS_DARK`: particle colors in dark theme.
- `LJ_MD_TYPE_COLORS_LIGHT`: particle colors in light theme.

## Runtime Controls

Keyboard:

- `h`: toggle help.
- `+`: increase target temperature by 1 K.
- `-`: decrease target temperature by 1 K.
- hold `+` or `-`: repeated changes use 10 K steps.
- `t`: toggle temperature display.
- `p`: toggle pressure display and computation.
- `e`: toggle total energy display and computation.
- `n`: toggle particle count display.
- `g`: toggle text HUD and graph HUD.

Mouse:

- left click: add particles near the mouse position.
- right click: toggle mouse steering between repulsive and attractive.
- mouse move: steer particles when mouse wall is enabled.

## Performance Notes

The current default path is serial force evaluation with a neighbor-cell list. For the current low-density visual setup, this is faster than copying particle arrays to multiple workers up to at least 1200 particles on the benchmarked machine.

Benchmark script:

```bash
python3 scripts/benchmark_parallel_threshold.py
```

The benchmark output is written to:

```text
scripts/parallel_threshold.csv
```

Parallel workers remain available for larger systems or higher-density settings. Change:

```js
var LJ_MD_PARALLEL_THRESHOLD = 2000;
var LJ_MD_WORKER_COUNT = 4;
```

## Stability Notes

The simulation is visual, not a production molecular dynamics engine.

Unstable settings usually come from:

- timestep too large;
- epsilon too large;
- sigma too small;
- force cap too high;
- particle insertion at high local density;
- very stiff attractive mouse settings.

If particles explode, first try lowering:

```js
LJ_MD_TIME_STEP_PS
LJ_MD_MAX_TOTAL_FORCE_EV_PER_A
LJ_MD_MAX_PARTICLE_KINETIC_DELTA_K
```

Then reduce aggressive `epsilonEv` values or increase problematic `sigmaAngstrom` values.

