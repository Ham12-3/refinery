# Research notes: procedural refinery

Notes gathered before building the Three.js model. The model is illustrative: layout rules and equipment are real, dimensions are typical, and the site itself is invented.

## Plot layout
- Units are laid out in process-flow order so piping runs stay short. Adjacent independent units are kept at least ~20 m apart.
- A main pipe rack runs through the plant. It is at least 6 m wide and leaves a 5 m × 5.5 m clear access way underneath. Secondary racks branch off to units.
- Fired heaters sit 15–30 m from other process equipment.
- Tank farms are a separate block with roads all round, grouped by product and surrounded by bund walls.
- Flares are sited away from and upwind of the process units (API 521 radiation limits).

Sources: [KLM layout & spacing standard](https://www.klmtechgroup.com/PDF/ess/PROJECT_STANDARDS_AND_SPECIFICATIONS_layout_and_spacing_Rev1.0.pdf), [AXA XL plant layout guideline](https://axaxl.com/-/media/axaxl/files/pdfs/prc-guidelines/prc-2/prc252oilandchemicalplantlayoutandspacingv1.pdf), [Plot plan (svlele)](http://www.svlele.com/piping/plot_plan.htm)

## Crude distillation unit (CDU)
- Preheat train and desalter, then the fired heater, then the atmospheric column. Feed enters the flash zone just above the bottom.
- Overhead vapour goes to air- or water-cooled condensers and then a reflux drum. Part of the liquid returns as reflux; the rest is light naphtha/LPG product.
- Side draws go to small side-stripper columns. Around three pump-around circuits remove heat.
- Vacuum column: residue goes on to a vacuum column held at 8–40 mmHg by 2–4 stages of steam ejectors. The column is swaged, with a wider middle section.

Sources: [Colorado School of Mines CBEN409 crude units](https://people.mines.edu/jjechura/wp-content/uploads/sites/120/2019/02/CBEN409_03_Crude_Units.pdf), [Penn State FSC432](https://courses.ems.psu.edu/fsc432/node/534), [Croll refinery vacuum systems](https://croll.com/refinery-vacuum-system/)

## Fired heaters
- A radiant section (the hottest, where tubes see the flame) sits under a convection section, which recovers heat from the flue gas before the stack.
- Box heaters use horizontal tubes; vertical cylindrical heaters use vertical tubes. Burners fire up from the floor.

Sources: [Fired heaters for dummies](https://www.digitalrefining.com/article/1002765/fired-heaters-for-dummies), [ScienceDirect fired heaters](https://www.sciencedirect.com/topics/engineering/fired-heaters)

## FCC
- Feed meets hot regenerated catalyst at the bottom of the riser and cracks on the way up. The reactor/disengager separates the catalyst.
- Spent catalyst drops through a stripper and the spent-catalyst standpipe into the regenerator, where coke is burned off with air from the main air blower.
- Cyclones remove catalyst fines from the flue gas. Slide valves on the standpipes control circulation.

Sources: [FCC regeneration overview](https://encyclopedia.pub/entry/20576)

## Hydrotreating and reforming
- Hydrotreater: feed plus hydrogen, charge heater, fixed-bed reactors, high-pressure separator, recycle gas compressor, stripper.
- Reformer: 3–4 reactors in series at about 480–500 °C, with interheater cells between them because the reactions are endothermic. It then has a separator and a stabilizer, and it produces hydrogen.

Sources: [ScienceDirect catalytic reforming](https://www.sciencedirect.com/topics/engineering/catalytic-reforming)

## Flare system
- Components: knock-out drum, liquid seal drum, header, stack (self-supported, guyed or derrick), molecular seal below the tip, flare tip, continuous pilots and the ignition system.
- Derrick-supported stacks suit tall flares, up to about 350 ft.

Sources: [OGJ flare systems](https://www.ogj.com/home/article/17219054/flare-systems-1-design-alternatives-components-key-to-optimum-flares), [EPA cost manual, flares](https://www.epa.gov/sites/default/files/2019-08/documents/flarescostmanualchapter7thedition_august2019vff.pdf)

## Storage
- External floating-roof tanks: pontoon ring, wind girder (stiffening ring), primary and secondary rim seals, roof drain, rolling ladder from the gauger's platform, and a spiral stair on the shell.
- LPG is stored in Horton spheres: spherical pressure vessels on legs attached at the equator, with cross-bracing.

Sources: [ScienceDirect floating roof tanks](https://www.sciencedirect.com/topics/engineering/floating-roof-tanks), [EPCLand API 650 guide](https://epcland.com/floating-roof-tank-design-guide/), [Horton sphere](https://en.wikipedia.org/wiki/Horton_sphere)

## Marine terminal
- A trestle from shore carries pipelines to a loading platform with marine loading arms.
- Breasting dolphins take berthing loads; mooring dolphins hold the lines. Catwalks link them.

Sources: [Oil terminal](https://en.wikipedia.org/wiki/Oil_terminal), [KLM marine loading spec](https://www.klmtechgroup.com/PDF/ess/PROJECT_STANDARD_AND_SPECIFICATIONS_marine_loading_unloading_Rev01web.pdf), [Mooring dolphin layout](https://iptek.its.ac.id/index.php/ijoce/article/download/2871/2240)

## Three.js technique
- Draw calls matter more than triangles, so static geometry is merged per material per unit with `BufferGeometryUtils.mergeGeometries`.
- Click-to-focus: get the target from the unit's bounds, then animate the camera position and the `OrbitControls.target` together, calling `controls.update()` each frame.

Sources: [three.js forum: zoom to selected object](https://discourse.threejs.org/t/simple-zoom-to-selected-object-in-the-scene-with-controls-and-camera-and-tweenjs/38824), [Wael Yasmina: GSAP camera transitions](https://waelyasmina.net/articles/animating-camera-transitions-in-three-js-using-gsap/), [100 Three.js performance tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
