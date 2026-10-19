# ATRIUM

A vertical fashion store built with three.js. You stand in the middle of a
square courtyard formed by four towers, and every lit window is a garment.
Scroll and you fall: the towers go on forever, into the dark. Click a window
and the camera flies inside; the piece opens in a fitting studio, where it
jumps from a rail onto a mannequin. You can turn it, zoom into the weave, and
change the colour and size.

**Live:** https://temirlan.work/atrium/ · https://temirlanzzz.github.io/atrium/

## What is in it

- **Four towers, four departments.** Outerwear, knit and jersey, dresses,
  and denim and trousers each face the courtyard, with vertical neon signs on
  the corner pillars. Every run of 9 floors is a new collection with its own
  palette.
- **An endless fall.** A ring of 24 floors is recycled as you move, and
  the world origin is rebased every 60 floors, so precision never degrades.
  The catalog is deterministic: window `(floor, side, column)` always shows
  the same product.
- **Procedural garments.** Coats, hoodies, sweaters, tees, dresses and
  trousers are lofted around a single body measurement, with folds that only
  push outward. The same mesh hangs as a "ghost mannequin" in a window and
  fits the studio mannequin exactly. Fabrics use `MeshPhysicalMaterial`
  sheen, with weave, knit, denim and jersey normal maps drawn on a canvas.
- **Instanced everything.** Each window holds a garment, a hanger or a
  lacquered dress form, oak shelves, four folded stacks, sneakers and
  sometimes a tote. That is roughly 15 draw calls for about 480 windows.
  Garments sway in the vertex shader, harder when you fall fast.
- **Film look.** ACES tone mapping, a PMREM room environment, bloom on the
  window light, then a grade pass whose vignette and chromatic fringe grow
  with speed, plus speed streaks and an FOV kick.

No textures, models or fonts are downloaded. Everything is generated at
load time.

## Controls

| | |
|---|---|
| Scroll / swipe | fall (or climb back up) |
| Drag, ← → | turn |
| `F` or the button | look up / look down |
| Click a window | open it in the fitting studio |
| Studio | drag to orbit, scroll to zoom, `Esc` to go back |

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/ (relative base, works under any path)
```

## Demo reel

`?capture` stops the render loop and exposes `window.__step(dt)`. The
scripted reel then renders identically on any machine, including a
software GPU:

```bash
npm run build && npm run preview &
CHROME_PATH=/path/to/chrome node scripts/capture.mjs --video   # → out/atrium-demo.mp4
node scripts/capture.mjs --stills 4.6                          # → out/still-4.6.png
```
