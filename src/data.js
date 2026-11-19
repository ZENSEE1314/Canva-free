import { MORE_TEMPLATES } from './templates2.js';

// Static data: design sizes, fonts, colors, elements, templates.

export const SIZE_PRESETS = [
  { name: 'Instagram Post', w: 1080, h: 1080, group: 'Social' },
  { name: 'Instagram Story', w: 1080, h: 1920, group: 'Social' },
  { name: 'Facebook Post', w: 1200, h: 630, group: 'Social' },
  { name: 'Facebook Cover', w: 1640, h: 624, group: 'Social' },
  { name: 'YouTube Thumbnail', w: 1280, h: 720, group: 'Video' },
  { name: 'YouTube Banner', w: 2560, h: 1440, group: 'Video' },
  { name: 'TikTok Video', w: 1080, h: 1920, group: 'Video' },
  { name: 'LinkedIn Post', w: 1200, h: 1200, group: 'Social' },
  { name: 'X / Twitter Post', w: 1600, h: 900, group: 'Social' },
  { name: 'Pinterest Pin', w: 1000, h: 1500, group: 'Social' },
  { name: 'Presentation 16:9', w: 1920, h: 1080, group: 'Business' },
  { name: 'Poster (A4)', w: 2480, h: 3508, group: 'Print' },
  { name: 'Flyer (Letter)', w: 2550, h: 3300, group: 'Print' },
  { name: 'Business Card', w: 1050, h: 600, group: 'Print' },
  { name: 'Logo', w: 500, h: 500, group: 'Business' },
  { name: 'Invitation', w: 1500, h: 2100, group: 'Print' },
  { name: 'Resume', w: 2550, h: 3300, group: 'Business' },
  { name: 'Desktop Wallpaper', w: 1920, h: 1080, group: 'Other' },
];

export const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Raleway', 'Oswald', 'Bebas Neue',
  'Anton', 'Archivo Black', 'Space Grotesk', 'Josefin Sans', 'Righteous', 'Playfair Display',
  'DM Serif Display', 'Abril Fatface', 'Lora', 'Merriweather', 'Lobster', 'Pacifico',
  'Dancing Script', 'Great Vibes', 'Caveat', 'Permanent Marker',
  'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Impact',
];

export const PALETTE = [
  '#000000', '#3f3f46', '#71717a', '#a1a1aa', '#e4e4e7', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#7c2d12',
];

export const GRADIENTS = [
  ['#ff7a45', '#7c3aed'], ['#f43f5e', '#f59e0b'], ['#06b6d4', '#3b82f6'], ['#22c55e', '#14b8a6'],
  ['#a855f7', '#ec4899'], ['#0f172a', '#334155'], ['#fde68a', '#fca5a5'], ['#bfdbfe', '#c4b5fd'],
  ['#000000', '#434343'], ['#ff9a9e', '#fecfef'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'], ['#f6d365', '#fda085'], ['#5ee7df', '#b490ca'], ['#1e3a8a', '#9333ea'],
];

export const TEXT_PRESETS = [
  { label: 'Add a heading', text: 'Add a heading', size: 0.09, weight: '800', font: 'Inter' },
  { label: 'Add a subheading', text: 'Add a subheading', size: 0.055, weight: '600', font: 'Inter' },
  { label: 'Add body text', text: 'Add a little bit of body text', size: 0.035, weight: '400', font: 'Inter' },
];

export const TEXT_COMBOS = [
  { text: 'BIG SALE', font: 'Anton', size: 0.14, color: '#ef4444', weight: 'normal' },
  { text: 'Hello there', font: 'Pacifico', size: 0.09, color: '#7c3aed', weight: 'normal' },
  { text: 'ELEGANT', font: 'Playfair Display', size: 0.1, color: '#111827', weight: 'bold', charSpacing: 300 },
  { text: 'Grand Opening', font: 'Great Vibes', size: 0.1, color: '#b45309', weight: 'normal' },
  { text: 'BREAKING', font: 'Bebas Neue', size: 0.13, color: '#ffffff', weight: 'normal', bg: '#111827' },
  { text: 'Marker Note', font: 'Permanent Marker', size: 0.08, color: '#0ea5e9', weight: 'normal' },
  { text: 'OUTLINE', font: 'Archivo Black', size: 0.12, color: 'transparent', stroke: '#111827', weight: 'normal' },
  { text: 'Neon Glow', font: 'Righteous', size: 0.1, color: '#f0abfc', weight: 'normal', glow: '#d946ef' },
];

// Shapes: each item describes how to build a fabric object (see elements.js).
export const SHAPES = [
  { id: 'rect', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'star', label: 'Star' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'heart', label: 'Heart' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'bubble', label: 'Speech' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'line', label: 'Line' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'arrowline', label: 'Arrow line' },
  { id: 'ring', label: 'Ring' },
  { id: 'blob', label: 'Blob' },
  { id: 'burst', label: 'Burst' },
];

export const STICKERS = [
  '😀', '😍', '🥳', '😎', '🤩', '😂', '🥰', '😇', '🔥', '✨', '⭐', '🌟', '💖', '💯', '🎉', '🎁',
  '🎈', '🎂', '🌈', '☀️', '🌙', '⚡', '❄️', '🌸', '🌺', '🌻', '🍀', '🌴', '🍕', '🍔', '🍩', '☕',
  '🍓', '🍉', '📷', '🎵', '🎧', '📚', '💡', '🚀', '✈️', '🏆', '⚽', '🏀', '💼', '📈', '🛒', '💰',
  '❤️', '💙', '💚', '💛', '💜', '🖤', '👍', '👏', '🙌', '✅', '❌', '⚠️', '📍', '📣', '🔔', '🕒',
];

// Templates use relative units (fractions of width/height) so they fit any canvas size.
// Text size is fraction of the smaller side.
export const TEMPLATES = [
  {
    name: 'Bold Sale',
    bg: { gradient: ['#f43f5e', '#f59e0b'] },
    items: [
      { t: 'circle', x: 0.85, y: 0.12, r: 0.22, fill: 'rgba(255,255,255,0.18)' },
      { t: 'circle', x: 0.1, y: 0.9, r: 0.3, fill: 'rgba(255,255,255,0.12)' },
      { t: 'text', text: 'MEGA', x: 0.5, y: 0.25, size: 0.12, font: 'Anton', fill: '#fff' },
      { t: 'text', text: 'SALE', x: 0.5, y: 0.42, size: 0.26, font: 'Anton', fill: '#fff' },
      { t: 'rect', x: 0.5, y: 0.7, w: 0.6, h: 0.1, fill: '#111827', rx: 0.05 },
      { t: 'text', text: 'UP TO 70% OFF', x: 0.5, y: 0.7, size: 0.055, font: 'Montserrat', weight: '900', fill: '#fde68a' },
      { t: 'text', text: 'This weekend only · Shop now', x: 0.5, y: 0.85, size: 0.035, font: 'Montserrat', fill: '#fff' },
    ],
  },
  {
    name: 'Minimal Quote',
    bg: { color: '#f5f0e8' },
    items: [
      { t: 'text', text: '“', x: 0.5, y: 0.22, size: 0.3, font: 'Playfair Display', fill: '#b45309' },
      { t: 'text', text: 'Simplicity is the ultimate sophistication.', x: 0.5, y: 0.5, w: 0.75, size: 0.07, font: 'Playfair Display', style: 'italic', fill: '#1f2937' },
      { t: 'rect', x: 0.5, y: 0.7, w: 0.12, h: 0.006, fill: '#b45309' },
      { t: 'text', text: 'YOUR NAME', x: 0.5, y: 0.77, size: 0.03, font: 'Montserrat', weight: '700', fill: '#6b7280', charSpacing: 400 },
    ],
  },
  {
    name: 'Event Poster',
    bg: { gradient: ['#0f172a', '#1e3a8a'] },
    items: [
      { t: 'shape', shape: 'burst', x: 0.78, y: 0.2, s: 0.28, fill: '#facc15' },
      { t: 'text', text: 'LIVE\nMUSIC', x: 0.47, y: 0.38, w: 0.8, size: 0.17, font: 'Bebas Neue', fill: '#fff', align: 'left' },
      { t: 'text', text: 'Friday Night Sessions', x: 0.47, y: 0.6, w: 0.8, size: 0.05, font: 'Space Grotesk', weight: '700', fill: '#93c5fd', align: 'left' },
      { t: 'rect', x: 0.5, y: 0.82, w: 0.9, h: 0.003, fill: '#334155' },
      { t: 'text', text: 'JUNE 21 · 8 PM · CITY HALL', x: 0.5, y: 0.89, size: 0.035, font: 'Space Grotesk', weight: '700', fill: '#e2e8f0', charSpacing: 200 },
    ],
  },
  {
    name: 'Birthday',
    bg: { gradient: ['#fbcfe8', '#c4b5fd'] },
    items: [
      { t: 'emoji', text: '🎈', x: 0.18, y: 0.2, size: 0.16 },
      { t: 'emoji', text: '🎉', x: 0.82, y: 0.22, size: 0.14 },
      { t: 'emoji', text: '🎂', x: 0.5, y: 0.78, size: 0.16 },
      { t: 'text', text: 'Happy', x: 0.5, y: 0.36, size: 0.13, font: 'Pacifico', fill: '#7c3aed' },
      { t: 'text', text: 'BIRTHDAY', x: 0.5, y: 0.52, size: 0.11, font: 'Archivo Black', fill: '#db2777', charSpacing: 100 },
      { t: 'text', text: 'Wishing you the best year ever', x: 0.5, y: 0.63, size: 0.035, font: 'Poppins', fill: '#4c1d95' },
    ],
  },
  {
    name: 'Business Pitch',
    bg: { color: '#ffffff' },
    items: [
      { t: 'rect', x: 0.2, y: 0.5, w: 0.4, h: 1, fill: '#4f46e5' },
      { t: 'shape', shape: 'ring', x: 0.2, y: 0.5, s: 0.25, fill: '#a5b4fc' },
      { t: 'text', text: 'Q4\nStrategy', x: 0.7, y: 0.4, w: 0.5, size: 0.1, font: 'Montserrat', weight: '900', fill: '#111827', align: 'left' },
      { t: 'text', text: 'Growth plan, key metrics and next steps for the team.', x: 0.7, y: 0.62, w: 0.5, size: 0.035, font: 'Inter', fill: '#4b5563', align: 'left' },
      { t: 'text', text: 'COMPANY NAME', x: 0.7, y: 0.85, w: 0.5, size: 0.025, font: 'Inter', weight: '700', fill: '#4f46e5', align: 'left', charSpacing: 300 },
    ],
  },
  {
    name: 'Fresh Promo',
    bg: { gradient: ['#43e97b', '#38f9d7'] },
    items: [
      { t: 'shape', shape: 'blob', x: 0.5, y: 0.45, s: 0.7, fill: '#ffffff' },
      { t: 'text', text: 'NEW', x: 0.5, y: 0.3, size: 0.06, font: 'Poppins', weight: '800', fill: '#059669', charSpacing: 500 },
      { t: 'text', text: 'Summer\nMenu', x: 0.5, y: 0.47, w: 0.7, size: 0.12, font: 'DM Serif Display', fill: '#064e3b' },
      { t: 'text', text: 'Fresh · Local · Tasty', x: 0.5, y: 0.65, size: 0.035, font: 'Poppins', fill: '#047857' },
      { t: 'rect', x: 0.5, y: 0.87, w: 0.42, h: 0.08, fill: '#064e3b', rx: 0.04 },
      { t: 'text', text: 'ORDER NOW', x: 0.5, y: 0.87, size: 0.035, font: 'Poppins', weight: '800', fill: '#fff' },
    ],
  },
  {
    name: 'Dark Tech',
    bg: { gradient: ['#000000', '#434343'] },
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.86, h: 0.86, fill: 'transparent', stroke: '#22d3ee', strokeW: 0.004 },
      { t: 'text', text: '</> DEV CONF', x: 0.5, y: 0.32, size: 0.04, font: 'Space Grotesk', weight: '700', fill: '#22d3ee', charSpacing: 300 },
      { t: 'text', text: 'Build the\nFuture', x: 0.5, y: 0.5, w: 0.8, size: 0.12, font: 'Space Grotesk', weight: '700', fill: '#ffffff' },
      { t: 'text', text: 'Register today', x: 0.5, y: 0.72, size: 0.035, font: 'Inter', fill: '#a1a1aa' },
    ],
  },
  {
    name: 'Wedding Invite',
    bg: { color: '#fffaf5' },
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.88, h: 0.9, fill: 'transparent', stroke: '#d4a373', strokeW: 0.003 },
      { t: 'text', text: 'Together with their families', x: 0.5, y: 0.22, size: 0.03, font: 'Lora', style: 'italic', fill: '#6b7280' },
      { t: 'text', text: 'Emma & James', x: 0.5, y: 0.4, w: 0.85, size: 0.1, font: 'Great Vibes', fill: '#a16207' },
      { t: 'text', text: 'REQUEST THE PLEASURE OF YOUR COMPANY', x: 0.5, y: 0.55, w: 0.8, size: 0.025, font: 'Montserrat', fill: '#374151', charSpacing: 200 },
      { t: 'text', text: 'Saturday · September 12\nThe Garden Venue', x: 0.5, y: 0.7, w: 0.8, size: 0.035, font: 'Lora', fill: '#1f2937' },
    ],
  },
  {
    name: 'YouTube Hook',
    bg: { color: '#fde047' },
    items: [
      { t: 'shape', shape: 'burst', x: 0.8, y: 0.5, s: 0.5, fill: '#ef4444' },
      { t: 'text', text: 'WOW!', x: 0.8, y: 0.5, size: 0.12, font: 'Anton', fill: '#fff', angle: -10 },
      { t: 'text', text: 'I TRIED\nTHIS FOR\n30 DAYS', x: 0.33, y: 0.5, w: 0.6, size: 0.13, font: 'Anton', fill: '#111827', align: 'left', stroke: '#ffffff', strokeW: 0.006 },
    ],
  },
];

// ---- Extra templates ----
TEMPLATES.push(
  {
    name: 'Coffee Shop',
    cat: 'Food',
    bg: { color: '#3b2a20' },
    items: [
      { t: 'circle', x: 0.5, y: 0.42, r: 0.3, fill: '#d6b48c' },
      { t: 'emoji', text: '☕', x: 0.5, y: 0.42, size: 0.25 },
      { t: 'text', text: 'Morning Brew', x: 0.5, y: 0.8, size: 0.09, font: 'Lobster', fill: '#f5e6d3' },
      { t: 'text', text: 'FRESHLY ROASTED · EVERY DAY', x: 0.5, y: 0.9, size: 0.03, font: 'Montserrat', weight: '700', fill: '#d6b48c', charSpacing: 250 },
    ],
  },
  {
    name: 'Fitness Challenge',
    cat: 'Social',
    bg: { gradient: ['#111827', '#7f1d1d'], angle: 90 },
    items: [
      { t: 'text', text: '30 DAY', x: 0.5, y: 0.17, size: 0.1, font: 'Bebas Neue', fill: '#f87171', charSpacing: 200 },
      { t: 'text', text: 'FITNESS\nCHALLENGE', x: 0.5, y: 0.45, w: 0.9, size: 0.15, font: 'Anton', fill: '#ffffff' },
      { t: 'rect', x: 0.5, y: 0.7, w: 0.5, h: 0.006, fill: '#f87171' },
      { t: 'text', text: 'Join us · Starts Monday', x: 0.5, y: 0.78, size: 0.04, font: 'Oswald', fill: '#fecaca' },
      { t: 'emoji', text: '💪', x: 0.85, y: 0.88, size: 0.1 },
    ],
  },
  {
    name: 'Real Estate',
    cat: 'Business',
    bg: { color: '#f8fafc' },
    items: [
      { t: 'rect', x: 0.5, y: 0.3, w: 1, h: 0.6, fill: '#cbd5e1' },
      { t: 'emoji', text: '🏡', x: 0.5, y: 0.3, size: 0.28 },
      { t: 'rect', x: 0.5, y: 0.6, w: 0.5, h: 0.08, fill: '#0f766e' },
      { t: 'text', text: 'JUST LISTED', x: 0.5, y: 0.6, size: 0.04, font: 'Montserrat', weight: '900', fill: '#fff', charSpacing: 300 },
      { t: 'text', text: '3 bed · 2 bath · Garden', x: 0.5, y: 0.75, size: 0.045, font: 'Poppins', weight: '600', fill: '#0f172a' },
      { t: 'text', text: 'Call 555-0100 for a viewing', x: 0.5, y: 0.84, size: 0.03, font: 'Poppins', fill: '#475569' },
    ],
  },
  {
    name: 'Motivation',
    cat: 'Quote',
    bg: { gradient: ['#30cfd0', '#330867'] },
    items: [
      { t: 'text', text: 'Dream big.\nStart small.\nAct now.', x: 0.5, y: 0.47, w: 0.85, size: 0.1, font: 'Poppins', weight: '800', fill: '#ffffff' },
      { t: 'text', text: '@yourhandle', x: 0.5, y: 0.88, size: 0.03, font: 'Poppins', fill: '#cffafe' },
    ],
  },
  {
    name: 'Black Friday',
    cat: 'Sale',
    bg: { color: '#000000' },
    items: [
      { t: 'text', text: 'BLACK', x: 0.5, y: 0.3, size: 0.2, font: 'Archivo Black', fill: '#ffffff' },
      { t: 'text', text: 'FRIDAY', x: 0.5, y: 0.48, size: 0.2, font: 'Archivo Black', fill: 'transparent', stroke: '#facc15', strokeW: 0.005 },
      { t: 'shape', shape: 'burst', x: 0.5, y: 0.75, s: 0.3, fill: '#facc15' },
      { t: 'text', text: '-50%', x: 0.5, y: 0.75, size: 0.08, font: 'Anton', fill: '#000000' },
    ],
  },
  {
    name: 'Thank You Card',
    cat: 'Cards',
    bg: { color: '#fdf2f8' },
    items: [
      { t: 'shape', shape: 'heart', x: 0.5, y: 0.3, s: 0.22, fill: '#f472b6' },
      { t: 'text', text: 'Thank You', x: 0.5, y: 0.55, size: 0.13, font: 'Great Vibes', fill: '#9d174d' },
      { t: 'text', text: 'for being part of our journey', x: 0.5, y: 0.68, size: 0.035, font: 'Lora', style: 'italic', fill: '#831843' },
    ],
  },
  {
    name: 'Podcast Cover',
    cat: 'Social',
    bg: { gradient: ['#a855f7', '#ec4899'] },
    items: [
      { t: 'circle', x: 0.5, y: 0.38, r: 0.22, fill: '#1e1b4b' },
      { t: 'emoji', text: '🎧', x: 0.5, y: 0.38, size: 0.2 },
      { t: 'text', text: 'THE DAILY\nCREATIVE', x: 0.5, y: 0.75, w: 0.9, size: 0.1, font: 'Space Grotesk', weight: '700', fill: '#ffffff' },
      { t: 'text', text: 'PODCAST', x: 0.5, y: 0.91, size: 0.035, font: 'Space Grotesk', weight: '700', fill: '#fce7f3', charSpacing: 600 },
    ],
  },
  {
    name: 'Webinar',
    cat: 'Business',
    bg: { color: '#eef2ff' },
    items: [
      { t: 'rect', x: 0.08, y: 0.5, w: 0.03, h: 0.6, fill: '#4f46e5' },
      { t: 'text', text: 'FREE WEBINAR', x: 0.5, y: 0.25, w: 0.8, size: 0.04, font: 'Inter', weight: '800', fill: '#4f46e5', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'How to Grow Your Audience in 2027', x: 0.5, y: 0.45, w: 0.8, size: 0.08, font: 'Inter', weight: '800', fill: '#1e1b4b', align: 'left' },
      { t: 'text', text: 'Thursday · 6 PM · Online', x: 0.5, y: 0.65, w: 0.8, size: 0.035, font: 'Inter', fill: '#4338ca', align: 'left' },
      { t: 'rect', x: 0.3, y: 0.8, w: 0.36, h: 0.08, fill: '#4f46e5', rx: 0.02 },
      { t: 'text', text: 'Save your seat', x: 0.3, y: 0.8, size: 0.03, font: 'Inter', weight: '700', fill: '#fff' },
    ],
  },
  {
    name: 'Travel',
    cat: 'Social',
    bg: { gradient: ['#0ea5e9', '#fde68a'], angle: 90 },
    items: [
      { t: 'circle', x: 0.75, y: 0.25, r: 0.12, fill: '#fef08a' },
      { t: 'emoji', text: '🌴', x: 0.2, y: 0.7, size: 0.3 },
      { t: 'text', text: 'Explore', x: 0.55, y: 0.48, size: 0.14, font: 'Pacifico', fill: '#ffffff' },
      { t: 'text', text: 'THE WORLD', x: 0.55, y: 0.62, size: 0.06, font: 'Montserrat', weight: '900', fill: '#0c4a6e', charSpacing: 400 },
    ],
  },
  {
    name: 'Hiring',
    cat: 'Business',
    bg: { color: '#fef3c7' },
    items: [
      { t: 'text', text: "WE'RE", x: 0.5, y: 0.2, size: 0.07, font: 'Archivo Black', fill: '#92400e' },
      { t: 'text', text: 'HIRING!', x: 0.5, y: 0.35, size: 0.18, font: 'Archivo Black', fill: '#111827' },
      { t: 'rect', x: 0.5, y: 0.58, w: 0.7, h: 0.18, fill: '#ffffff', rx: 0.02 },
      { t: 'text', text: 'Designer · Developer · Marketer', x: 0.5, y: 0.58, w: 0.65, size: 0.04, font: 'Poppins', weight: '600', fill: '#111827' },
      { t: 'text', text: 'Apply at yourcompany.com/jobs', x: 0.5, y: 0.82, size: 0.035, font: 'Poppins', fill: '#92400e' },
    ],
  },
  {
    name: 'Menu Board',
    cat: 'Food',
    bg: { color: '#1f2937' },
    items: [
      { t: 'text', text: 'Menu', x: 0.5, y: 0.13, size: 0.11, font: 'Dancing Script', weight: '700', fill: '#fbbf24' },
      { t: 'text', text: 'Margherita Pizza ........ $12\nPasta Carbonara ......... $14\nCaesar Salad .............. $9\nTiramisu .................... $7', x: 0.5, y: 0.5, w: 0.82, size: 0.042, font: 'Josefin Sans', fill: '#f9fafb', align: 'left' },
      { t: 'text', text: 'Open daily 11am – 10pm', x: 0.5, y: 0.88, size: 0.03, font: 'Josefin Sans', fill: '#9ca3af' },
    ],
  },
  {
    name: 'Christmas',
    cat: 'Holiday',
    bg: { gradient: ['#14532d', '#166534'] },
    items: [
      { t: 'emoji', text: '🎄', x: 0.5, y: 0.3, size: 0.25 },
      { t: 'emoji', text: '❄️', x: 0.15, y: 0.15, size: 0.07 },
      { t: 'emoji', text: '❄️', x: 0.85, y: 0.2, size: 0.06 },
      { t: 'text', text: 'Merry Christmas', x: 0.5, y: 0.62, w: 0.9, size: 0.1, font: 'Great Vibes', fill: '#fde68a' },
      { t: 'text', text: 'AND A HAPPY NEW YEAR', x: 0.5, y: 0.75, size: 0.03, font: 'Montserrat', weight: '700', fill: '#dcfce7', charSpacing: 300 },
    ],
  },
  {
    name: 'New Year',
    cat: 'Holiday',
    bg: { gradient: ['#0f172a', '#4c1d95'] },
    items: [
      { t: 'emoji', text: '🎆', x: 0.2, y: 0.2, size: 0.15 },
      { t: 'emoji', text: '✨', x: 0.82, y: 0.25, size: 0.1 },
      { t: 'text', text: 'HAPPY NEW YEAR', x: 0.5, y: 0.45, size: 0.06, font: 'Montserrat', weight: '900', fill: '#e9d5ff', charSpacing: 400 },
      { t: 'text', text: '2027', x: 0.5, y: 0.62, size: 0.22, font: 'Abril Fatface', fill: '#fbbf24' },
    ],
  },
  {
    name: 'Product Launch',
    cat: 'Sale',
    bg: { color: '#ffffff' },
    items: [
      { t: 'shape', shape: 'blob', x: 0.68, y: 0.45, s: 0.6, fill: '#c7d2fe' },
      { t: 'emoji', text: '🚀', x: 0.68, y: 0.45, size: 0.25 },
      { t: 'text', text: 'Now\navailable', x: 0.3, y: 0.4, w: 0.5, size: 0.1, font: 'DM Serif Display', fill: '#1e1b4b', align: 'left' },
      { t: 'text', text: 'Meet the all-new version. Faster, simpler, better.', x: 0.3, y: 0.62, w: 0.5, size: 0.032, font: 'Inter', fill: '#475569', align: 'left' },
      { t: 'rect', x: 0.22, y: 0.82, w: 0.34, h: 0.08, fill: '#4f46e5', rx: 0.04 },
      { t: 'text', text: 'Learn more', x: 0.22, y: 0.82, size: 0.032, font: 'Inter', weight: '700', fill: '#fff' },
    ],
  },
  {
    name: 'Business Card',
    cat: 'Cards',
    bg: { color: '#0f172a' },
    items: [
      { t: 'rect', x: 0.06, y: 0.5, w: 0.02, h: 1, fill: '#f59e0b' },
      { t: 'text', text: 'Alex Morgan', x: 0.5, y: 0.35, w: 0.8, size: 0.11, font: 'Playfair Display', weight: 'bold', fill: '#ffffff', align: 'left' },
      { t: 'text', text: 'CREATIVE DIRECTOR', x: 0.5, y: 0.5, w: 0.8, size: 0.04, font: 'Montserrat', weight: '700', fill: '#f59e0b', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'alex@example.com\n+1 555 0100', x: 0.5, y: 0.75, w: 0.8, size: 0.045, font: 'Inter', fill: '#cbd5e1', align: 'left' },
    ],
  },
  {
    name: 'Halloween',
    cat: 'Holiday',
    bg: { gradient: ['#1c1917', '#7c2d12'] },
    items: [
      { t: 'emoji', text: '🎃', x: 0.5, y: 0.32, size: 0.28 },
      { t: 'text', text: 'Spooky Night', x: 0.5, y: 0.62, size: 0.1, font: 'Permanent Marker', fill: '#fb923c' },
      { t: 'text', text: 'COSTUME PARTY · OCT 31', x: 0.5, y: 0.74, size: 0.035, font: 'Oswald', weight: '700', fill: '#fed7aa', charSpacing: 200 },
    ],
  }
);

TEMPLATES.push(...MORE_TEMPLATES);

export const FORMATS = {
  ig: { name: 'Instagram Post', w: 1080, h: 1080 },
  yt: { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  story: { name: 'Instagram Story', plural: 'Instagram Stories', w: 1080, h: 1920 },
  pres: { name: 'Presentation', w: 1920, h: 1080 },
  poster: { name: 'Poster / Flyer', plural: 'Posters & Flyers', w: 2480, h: 3508 },
  card: { name: 'Business Card', w: 1050, h: 600 },
  invite: { name: 'Invitation', w: 1500, h: 2100 },
  resume: { name: 'Resume', w: 2550, h: 3300 },
  logo: { name: 'Logo', w: 500, h: 500 },
  fbcover: { name: 'Facebook Cover', w: 1640, h: 624 },
};
const DEFAULT_FMT = { 'YouTube Hook': 'yt', 'Business Card': 'card', 'Business Pitch': 'pres', 'Wedding Invite': 'invite' };
TEMPLATES.forEach((t) => { if (!t.fmt) t.fmt = DEFAULT_FMT[t.name] || 'ig'; });

/** Format keys whose aspect ratio matches w×h (within 1%). */
export function formatsFor(w, h) {
  const r = w / h;
  return Object.entries(FORMATS).filter(([, f]) => Math.abs(f.w / f.h - r) / r < 0.01).map(([k]) => k);
}

const DEFAULT_CATS = {
  'Bold Sale': 'Sale', 'Minimal Quote': 'Quote', 'Event Poster': 'Event', Birthday: 'Cards', 'Business Pitch': 'Business',
  'Fresh Promo': 'Food', 'Dark Tech': 'Event', 'Wedding Invite': 'Cards', 'YouTube Hook': 'Social',
};
TEMPLATES.forEach((t) => { if (!t.cat) t.cat = DEFAULT_CATS[t.name] || 'Other'; });
export const TEMPLATE_CATS = ['All', ...new Set(TEMPLATES.map((t) => t.cat))];
