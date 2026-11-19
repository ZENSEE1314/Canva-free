# Artvas

Artvas is a free design editor that runs in the browser. Use it to make social posts, posters, presentations, cards and more.

## Features

- **Start screen**: 18 size presets (Instagram, Story, YouTube, Presentation, A4 poster, business card and more), custom sizes, your saved designs (open, duplicate, delete), and opening a `.json` project file.
- **Templates**: 25 ready-made templates with search and categories (Sale, Social, Business, Food, Holiday, Cards, Quote, Event). Each one scales to any canvas size and stays fully editable.
- **Text**: heading, subheading and body presets, styled font combinations, and 29 fonts. You can set bold, italic, underline, strikethrough, alignment, uppercase or lowercase, line height, letter spacing, highlight, outline, shadow and glow.
- **Elements**: 18 shapes and lines (star, heart, arrow, speech bubble, burst, blob and others), 64 stickers, and image frames (circle, rounded, star, heart, hexagon).
- **Uploads**: upload images, drag and drop them onto the canvas, or paste them from the clipboard. Your recent uploads are kept.
- **Photos**: free stock photos (Lorem Picsum). Add a photo to the page or use it as the background.
- **Draw**: freehand pen and eraser with adjustable size and color.
- **Background**: solid colors, gradient presets, custom gradients (two colors and an angle), and background images.
- **Layers**: drag to reorder, show or hide, lock, and delete.
- **Edit panel**: fill and gradient fill, border (solid or dashed), corner radius, transparency, blend modes, shadow, align to page, exact X/Y/W/H/rotation, flip, and bring to front or send to back.
- **Image adjustments**: brightness, contrast, saturation, hue, blur and pixelate, plus filters (grayscale, sepia, vintage, polaroid and more). You can also replace an image.
- **Pages**: add, duplicate, reorder and delete pages.
- **Smart guides**: objects snap to the page center and edges.
- **Undo and redo, copy and paste, duplicate, group and ungroup, lock, and a right-click menu.**
- **Resize**: change a design to another size, either in place or as a resized copy.
- **Download**: PNG (with an optional transparent background), JPG, SVG, a multi-page PDF, or a `.json` project file. You can export at 0.5× to 3× size.
- **Background remover**: AI background removal ([BiRefNet_lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX), MIT license) that runs privately in the browser. The model is downloaded once (about 115 MB) and then cached. There is also a "remove a color" tool for logos and flat backgrounds, and you can restore the original image.
- **Animations**: 13 element animations (fade, rise, drop, slide, zoom, pop, spin, bounce, typewriter, blink, pulse, wiggle), whole-page presets with staggered timing, per-element duration and delay, page duration, and a live preview.
- **Animated downloads**: an animated GIF, or an MP4 video (WebM in browsers that can't record MP4). Every page plays in order.
- **Brand Kit**: brand colors (shown in every color picker and applied to a page in one click), heading and body fonts, custom font upload (.ttf/.otf/.woff), and logos.
- **Version history**: a version is saved automatically every 3 minutes while you edit. You can also save named versions and restore any of the last 30.
- **Autosave**: designs are saved automatically in the browser (IndexedDB).

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+C / V / X | Copy / paste / cut |
| Ctrl+D | Duplicate |
| Ctrl+G / Ctrl+Shift+G | Group / ungroup |
| Ctrl+A | Select all |
| Delete, arrow keys (add Shift to move further) | Delete, nudge |
| Ctrl + / − / 0 | Zoom in / out / fit |
| T, R, C | Add text, rectangle, circle |

## Run locally

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production build into dist/
npm start          # serve dist/ on $PORT (default 3000)
```

## Deploy on Railway

1. Go to [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → choose this repository.
2. Railway reads `railway.json`. It builds with `npm ci && npm run build`, starts with `npm start`, and checks health at `/health`.
3. Open the service → **Settings** → **Networking** → **Generate Domain** to get a public URL.

You don't need any environment variables. Railway sets `PORT` automatically.

## Tech

Vanilla JS, [Fabric.js](https://fabricjs.com) 6, jsPDF, gifenc and Vite, served by a small Express server. The background remover loads [transformers.js](https://github.com/huggingface/transformers.js) from a CDN only when it is first used.
