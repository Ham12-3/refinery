# Refinery

Two interactive takes on a coastal oil refinery.

## `index.html`: 3D explorer (procedural Three.js)

The whole plant is modelled procedurally in Three.js. There are no external 3D assets. It has 12 labelled units:

- Distillation: crude distillation unit and vacuum distillation unit
- Heating and conversion: crude charge heater, hydrotreater, catalytic reformer, FCC
- Plant-wide: main pipe rack, cooling tower
- Storage: LPG spheres and tank farm
- Relief and shipping: flare, and the marine terminal with a moored tanker

Click a unit, or its numbered marker, and the camera flies in to it. A side panel explains what the unit does and lists its equipment. Each equipment item zooms in further.

Other features:
- Golden-hour sky, a custom ocean shader, and shadows that follow the camera
- Bloom on flames and lamps, animated fans, steam and flue-gas plumes
- A day/night switch and a guided tour
- Deep links, for example `#fcc` or `#fcc/3`

Controls: drag to orbit, scroll to zoom, right-drag to pan, ← / → to step through units, Esc to go back.

- `js/kit.js`: geometry kit (vessels, platforms, caged ladders, railings, pipes, steel frames, stairs). It merges geometry per material to keep draw calls low.
- `js/units.js`: the 12 units, their equipment callouts and descriptions
- `js/env.js`: sky, sun and shadows, sea, ground, day/night modes
- `js/main.js`: renderer, post-processing, picking, camera flights, markers, UI
- `RESEARCH.md`: research notes and sources used for the layout and equipment

## `film.html`: scroll-driven drone footage

An 8 s drone clip split into 192 frames that play back as you scroll. Nine parts are tracked with optical flow (`tools/track.py`) and labelled with 3D callouts.

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

The model is illustrative. Dimensions are typical for plants of this kind, not measurements of a real site.
