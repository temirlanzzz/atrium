# ATRIUM

A vertical department store built with three.js. You stand in the middle of a
square courtyard formed by four stone towers, and every lit shop window is a
product. Scroll and you go down: the towers continue forever, into the mist.
Click a window and the camera flies in, and the product opens on a real product
page. Turn it in a bright photo studio, zoom in, switch between its real
colourways, pick a size and add it to your bag.

**Live:** https://temirlan.work/atrium/ · https://temirlanzzz.github.io/atrium/

## What is in it

- **Real products.** Sneakers, a chronograph watch, aviator sunglasses, a
  corset, a velvet sofa, chairs, a pouf, a lamp, plants and vases are 3D
  scans from the Khronos glTF sample library (see [CREDITS.md](CREDITS.md)).
  Their real `KHR_materials_variants` colourways (Midnight / Beach / Street
  for the sneaker, five velvets for the sofa) become the colour options on
  the product page.
- **Four departments.** Each tower is one department: Outerwear & Knit,
  Shoes & Accessories, Dresses & Couture, and Home. Each window is laid out
  around its hero product: a rail with oak shelves and folded stacks, a
  sneaker wall, accessory plinths, or a furnished vignette.
- **Real light.** An overcast HDRI sky lights the courtyard and is reflected
  in the glass. Window interiors have oak floors, warm ceiling lights and
  contact shadows. The product page is a seamless studio sweep with soft
  shadows.
- **An endless store.** A ring of 24 floors is recycled as you move, and
  the world origin is rebased every 60 floors, so precision never degrades.
  The catalog is deterministic: window `(floor, side, column)` always shows
  the same product.
- **Cheap at scale.** The windows use simplified copies of each scan, with
  one `InstancedMesh` per part and colourway. Glass that uses transmission
  on the product page becomes plain reflective glass in the windows, so
  hundreds of products cost a few dozen draw calls. Full-detail scans load
  only when you open a product.
- **Garments** (coats, knits, dresses, denim) are still procedural, lofted
  around one body with a real woven-fabric normal map. They are the least
  photoreal part, and the first thing to replace with real garment scans.

## Controls

| | |
|---|---|
| Scroll / swipe | fall (or climb back up) |
| Drag, ← → | turn |
| `F` or the button | look up / look down |
| Click a window | open its product page |
| Department links | turn to face that tower |
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
node scripts/capture.mjs --shot sofa --stills 11               # open a sofa and grab its product page
node scripts/capture.mjs --shot reel --video                   # the portfolio reel
```
