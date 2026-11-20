# Artvas

Artvas is a free all-in-one creative studio that runs in the browser. It has a design editor for social posts, posters and presentations, a timeline video editor for TikTok, Instagram Reels, Xiaohongshu (RED), Facebook and YouTube, and AI image and video generation.

## Video editor

- **Platform presets**: TikTok, Instagram Reels, Xiaohongshu / RED (3:4), Facebook Reels and feed (4:5), YouTube Shorts, YouTube (16:9) and square.
- **Starter layouts**: Hook + captions, Vlog intro, Product promo, How-to steps, RED note cover, and Quote / lyrics.
- **Timeline**: a main video track, overlay tracks for text and stickers, and audio tracks. Drag clips to reorder them, drag edges to trim, split at the playhead (S), duplicate, delete and undo/redo. Use the zoom buttons to zoom the timeline.
- **Clips**: speed (0.25×–3×), volume and mute, fill frame or fit with a blurred background, 8 filters plus brightness, contrast and saturation, and 9 transitions (crossfade, dip to black, flash, slide, push, zoom, wipe, blur).
- **Text and stickers**: 9 text styles (title, caption, outline, highlight, neon, lower third…), emoji stickers and the 3D graphics library. Drag them on the video to move them and drag the corner to resize. Each has in and out animations (fade, pop, slide, zoom, typewriter).
- **Audio**: add music and voice-overs with volume and fade in/out. Clip sound is mixed in automatically.
- **Designs as slides**: turn any Artvas design into a video slide, one clip per page.
- **AI**: generate image clips, or video clips with Seedance, Wan, Kling, PixVerse or Veo 3, using your own Muapi key.
- **Video templates**: 35 Artvas templates (photo dump, beat sync, glitch intro, POV, GRWM, story time, year recap, day in my life, travel diary, recipe, OOTD, before/after, glow up, gym progress, top 3 countdown, product launch, flash sale, home tour, lyrics, RED note and more). Pick your photos and videos and they fill the slots, with cuts, effects, transitions and animated text already set up.
- **More sizes**: phone full-screen (19.5:9, iPhone 15/16, iPhone Pro Max, Android 20:9, QHD+), vertical HD and 4K, 4:5, 3:4, 2:3, 4K UHD, cinematic 21:9 and 4:3, plus any custom size up to 4096 px.
- **Effects**: zoom in or out (Ken Burns), pan, beat pulse, shake, glitch, flash, blur in, VHS, vignette and mirror. There are also 13 transitions, including zoom blur, circle, spin and glitch.
- **Crop and position**: zoom, move, rotate 90° and flip any clip. You can also replace a clip and add a freeze frame.
- **Picture-in-picture**: put videos or photos on top of the main video, with green-screen (chroma key) removal, volume, circle crop and rotation.
- **Keyframes**: animate the position, size and opacity of text, stickers and overlays between keyframes.
- **Captions**: automatic captions from speech (Whisper, running in the browser, auto-detects the language, 2–6 words per caption or full lines), captions from a typed script, and 5 caption styles.
- **Export**: MP4 (or WebM) at 480p up to full size, with mixed audio. Projects and media are saved in your browser (IndexedDB).

## Features

- **Start screen**: 18 size presets (Instagram, Story, YouTube, Presentation, A4 poster, business card and more), custom sizes, your saved designs (open, duplicate, delete), and opening a `.json` project file.
- **Templates**: 62 Artvas templates in 10 formats. The 43 trending designs (23 Instagram posts, 14 YouTube thumbnails, 4 Stories and 2 presentations) use current styles: aurora gradients, film grain, editorial serif and bold sans type, Y2K chrome, bento grids, sticker collages, neon glow and glass cards. There are also posters, business cards, invitations, a resume, logos and Facebook covers. You can search them and filter by category or format, and each one scales to any canvas size.
- **Photo placeholders**: dashed frames in templates. Select one and upload a photo, or click any image in Uploads, Photos or your Brand Kit logos, and it fills the frame cropped to fit. You can also add your own placeholders from the Elements tab.
- **Text**: heading, subheading and body presets, styled font combinations, and 29 fonts. You can set bold, italic, underline, strikethrough, alignment, uppercase or lowercase, line height, letter spacing, highlight, outline, shadow and glow.
- **Elements**: a Canva-style library with search and "See all" views. It has 940+ glossy 3D graphics (Microsoft Fluent Emoji 3D, MIT), 930+ colourful illustrations (Google Noto Emoji, Apache-2.0) and 2,000+ recolourable icons (Lucide, ISC), all organised by category. There are also shapes and lines, photo frames (circle, arch, heart, star, polaroid, phone…), photo grids and collages, editable charts (bar, horizontal bar, line, donut, pie, progress ring), editable tables, gradient shapes and stickers. The artwork is bundled in `public/elements/` (rebuild it with `scripts/build-elements.py`).
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
- **My templates**: save any design (one page or all pages) as your own template with a name and category. Templates fit any design size when used. You can use them from the editor or start a new design from the home page, and rename, delete, export and import them (a `.json` file, so you can move them to another browser or computer).
- **AI Image**: generate images with 10+ models (Flux, Nano Banana, Seedream, Imagen 4, Ideogram, Midjourney, GPT Image…) through [Muapi.ai](https://muapi.ai), using your own API key. The approach is based on the MIT-licensed [Open Higgsfield AI](https://github.com/sunnychase/open-higgsfield-ai). You can pick a style and an image shape. Results go onto the page or into the selected photo spot, and **Generate photos for this page** fills every photo spot in a template using prompts written for that template. Your key is stored only in your browser. On the Artvas server, requests go through a small relay (`/api/muapi/*`) that passes your key through and never stores it.
- **Background remover**: AI background removal that runs privately in the browser. With a GPU it uses [BiRefNet_lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) (MIT, about 115 MB); otherwise it uses [ormbg](https://huggingface.co/onnx-community/ormbg-ONNX) (Apache-2.0, about 44 MB). The model is downloaded once and then cached. There is also a "remove a color" tool for logos and flat backgrounds, and you can restore the original image.
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
