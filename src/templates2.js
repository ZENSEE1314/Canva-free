// Artvas original templates, grouped by format.
// Units: x, y = center (fraction of width / height). w, h = fraction of width / height.
// size, r, s, rx, strokeW = fraction of the smaller page side.
// t: 'text' | 'emoji' | 'rect' | 'circle' | 'shape' | 'photo' (a placeholder you click to fill with your photo)

const IG = [
  {
    name: 'Product Spotlight', cat: 'Shop',
    bg: { color: '#fef3c7' },
    items: [
      { t: 'circle', x: 0.5, y: 0.45, r: 0.33, fill: '#fde68a' },
      { t: 'photo', x: 0.5, y: 0.45, r: 0.29 },
      { t: 'text', text: 'NEW ARRIVAL', x: 0.5, y: 0.08, size: 0.04, font: 'Montserrat', weight: '900', fill: '#92400e', charSpacing: 500 },
      { t: 'text', text: 'The Everyday Tote', x: 0.5, y: 0.84, size: 0.065, font: 'Playfair Display', weight: 'bold', fill: '#451a03' },
      { t: 'rect', x: 0.5, y: 0.93, w: 0.3, h: 0.06, fill: '#451a03', rx: 0.03 },
      { t: 'text', text: 'SHOP NOW', x: 0.5, y: 0.93, size: 0.028, font: 'Montserrat', weight: '800', fill: '#fef3c7', charSpacing: 300 },
    ],
  },
  {
    name: 'Flash Sale 24h', cat: 'Sale',
    bg: { gradient: ['#ef4444', '#7f1d1d'] },
    items: [
      { t: 'shape', shape: 'burst', x: 0.5, y: 0.45, s: 0.85, fill: 'rgba(255,255,255,0.08)' },
      { t: 'text', text: '⚡ FLASH ⚡', x: 0.5, y: 0.26, size: 0.08, font: 'Bebas Neue', fill: '#fde047', charSpacing: 200 },
      { t: 'text', text: 'SALE', x: 0.5, y: 0.45, size: 0.3, font: 'Anton', fill: '#ffffff', shadow: 'rgba(0,0,0,0.35)' },
      { t: 'text', text: 'Everything 40% off', x: 0.5, y: 0.64, size: 0.05, font: 'Poppins', weight: '700', fill: '#fee2e2' },
      { t: 'rect', x: 0.5, y: 0.82, w: 0.5, h: 0.09, fill: '#fde047', rx: 0.045 },
      { t: 'text', text: 'ENDS IN 24 HOURS', x: 0.5, y: 0.82, size: 0.035, font: 'Poppins', weight: '800', fill: '#7f1d1d' },
    ],
  },
  {
    name: 'Dark Quote', cat: 'Quote',
    bg: { color: '#18181b' },
    items: [
      { t: 'text', text: '“', x: 0.15, y: 0.2, size: 0.35, font: 'Abril Fatface', fill: '#a78bfa' },
      { t: 'text', text: 'Creativity is intelligence having fun.', x: 0.5, y: 0.5, w: 0.78, size: 0.08, font: 'Lora', style: 'italic', fill: '#fafafa', align: 'left', lh: 1.15 },
      { t: 'rect', x: 0.2, y: 0.74, w: 0.08, h: 0.005, fill: '#a78bfa' },
      { t: 'text', text: 'YOUR NAME', x: 0.5, y: 0.79, w: 0.78, size: 0.03, font: 'Montserrat', weight: '700', fill: '#a1a1aa', align: 'left', charSpacing: 400 },
    ],
  },
  {
    name: 'Tips Carousel', cat: 'Education',
    bg: { color: '#ecfeff' },
    items: [
      { t: 'rect', x: 0.5, y: 0.04, w: 1, h: 0.08, fill: '#0e7490' },
      { t: 'text', text: '5 SIMPLE TIPS FOR', x: 0.5, y: 0.17, w: 0.85, size: 0.04, font: 'Inter', weight: '800', fill: '#0e7490', align: 'left', charSpacing: 200 },
      { t: 'text', text: 'Better Sleep', x: 0.5, y: 0.28, w: 0.85, size: 0.11, font: 'DM Serif Display', fill: '#083344', align: 'left' },
      { t: 'text', text: '1. Same bedtime every night\n2. No screens 1 hour before\n3. Keep the room cool\n4. Skip late caffeine\n5. Get morning sunlight', x: 0.5, y: 0.6, w: 0.85, size: 0.045, font: 'Inter', fill: '#164e63', align: 'left', lh: 1.5 },
      { t: 'text', text: 'Save for later  →', x: 0.5, y: 0.91, w: 0.85, size: 0.035, font: 'Inter', weight: '700', fill: '#0e7490', align: 'right' },
    ],
  },
  {
    name: 'Before & After', cat: 'Beauty',
    bg: { color: '#ffffff' },
    items: [
      { t: 'photo', x: 0.255, y: 0.5, w: 0.49, h: 0.76, fill: '#d6d3d1' },
      { t: 'photo', x: 0.745, y: 0.5, w: 0.49, h: 0.76, fill: '#e7e5e4' },
      { t: 'text', text: 'BEFORE', x: 0.255, y: 0.06, size: 0.045, font: 'Montserrat', weight: '900', fill: '#44403c', charSpacing: 300 },
      { t: 'text', text: 'AFTER', x: 0.745, y: 0.06, size: 0.045, font: 'Montserrat', weight: '900', fill: '#be185d', charSpacing: 300 },
      { t: 'text', text: 'Book your glow-up today', x: 0.5, y: 0.94, size: 0.04, font: 'Playfair Display', style: 'italic', fill: '#44403c' },
    ],
  },
  {
    name: 'Giveaway', cat: 'Social',
    bg: { gradient: ['#a855f7', '#ec4899'] },
    items: [
      { t: 'emoji', text: '🎁', x: 0.5, y: 0.2, size: 0.18 },
      { t: 'text', text: 'GIVEAWAY', x: 0.5, y: 0.4, size: 0.16, font: 'Anton', fill: '#ffffff', shadow: 'rgba(0,0,0,0.25)' },
      { t: 'rect', x: 0.5, y: 0.68, w: 0.76, h: 0.3, fill: 'rgba(255,255,255,0.18)', rx: 0.04 },
      { t: 'text', text: 'HOW TO ENTER\n1. Follow this account\n2. Like this post\n3. Tag 2 friends', x: 0.5, y: 0.68, w: 0.66, size: 0.042, font: 'Poppins', weight: '600', fill: '#ffffff', lh: 1.4 },
      { t: 'text', text: 'Winner announced Friday', x: 0.5, y: 0.92, size: 0.032, font: 'Poppins', fill: '#fce7f3' },
    ],
  },
  {
    name: 'Customer Review', cat: 'Business',
    bg: { color: '#f8fafc' },
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.86, h: 0.8, fill: '#ffffff', rx: 0.04, stroke: '#e2e8f0', strokeW: 0.003 },
      { t: 'text', text: '★★★★★', x: 0.5, y: 0.22, size: 0.08, font: 'Arial', fill: '#f59e0b', charSpacing: 200 },
      { t: 'text', text: '“Fast delivery, amazing quality and the friendliest support. Will order again!”', x: 0.5, y: 0.43, w: 0.72, size: 0.05, font: 'Lora', style: 'italic', fill: '#1e293b', lh: 1.3 },
      { t: 'photo', x: 0.5, y: 0.67, r: 0.07 },
      { t: 'text', text: 'Jamie L.', x: 0.5, y: 0.78, size: 0.04, font: 'Inter', weight: '700', fill: '#0f172a' },
      { t: 'text', text: 'VERIFIED CUSTOMER', x: 0.5, y: 0.83, size: 0.024, font: 'Inter', weight: '600', fill: '#64748b', charSpacing: 300 },
    ],
  },
  {
    name: 'Recipe Card', cat: 'Food',
    bg: { color: '#fff7ed' },
    items: [
      { t: 'photo', x: 0.5, y: 0.25, w: 1, h: 0.5, fill: '#fed7aa' },
      { t: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.08, fill: '#ea580c', rx: 0.04 },
      { t: 'text', text: '15 MIN RECIPE', x: 0.5, y: 0.5, size: 0.032, font: 'Poppins', weight: '800', fill: '#ffffff', charSpacing: 200 },
      { t: 'text', text: 'Avocado Toast', x: 0.5, y: 0.62, size: 0.09, font: 'DM Serif Display', fill: '#431407' },
      { t: 'text', text: 'Sourdough · Avocado · Lemon · Chili flakes · Sea salt', x: 0.5, y: 0.74, w: 0.8, size: 0.032, font: 'Poppins', fill: '#9a3412' },
      { t: 'text', text: 'Full recipe in caption ↓', x: 0.5, y: 0.9, size: 0.03, font: 'Poppins', weight: '600', fill: '#ea580c' },
    ],
  },
  {
    name: 'Coming Soon', cat: 'Event',
    bg: { color: '#09090b' },
    items: [
      { t: 'text', text: 'COMING', x: 0.5, y: 0.38, size: 0.17, font: 'Archivo Black', fill: 'transparent', stroke: '#ffffff', strokeW: 0.004 },
      { t: 'text', text: 'SOON', x: 0.5, y: 0.56, size: 0.17, font: 'Archivo Black', fill: '#ffffff' },
      { t: 'rect', x: 0.5, y: 0.72, w: 0.12, h: 0.005, fill: '#22d3ee' },
      { t: 'text', text: '01 · 06 · 2027', x: 0.5, y: 0.8, size: 0.04, font: 'Space Grotesk', weight: '700', fill: '#22d3ee', charSpacing: 400 },
    ],
  },
  {
    name: 'We Moved', cat: 'Business',
    bg: { color: '#f5f5f4' },
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.88, h: 0.88, fill: 'transparent', stroke: '#292524', strokeW: 0.003 },
      { t: 'emoji', text: '📍', x: 0.5, y: 0.25, size: 0.12 },
      { t: 'text', text: 'We moved!', x: 0.5, y: 0.45, size: 0.12, font: 'DM Serif Display', fill: '#1c1917' },
      { t: 'text', text: 'Find us at our new home', x: 0.5, y: 0.57, size: 0.04, font: 'Inter', fill: '#57534e' },
      { t: 'text', text: '123 MAIN STREET · YOUR CITY', x: 0.5, y: 0.72, size: 0.03, font: 'Inter', weight: '700', fill: '#1c1917', charSpacing: 300 },
    ],
  },
  {
    name: 'Monday Motivation', cat: 'Quote',
    bg: { gradient: ['#f97316', '#f43f5e'] },
    items: [
      { t: 'text', text: 'MONDAY MOTIVATION', x: 0.5, y: 0.16, size: 0.035, font: 'Montserrat', weight: '800', fill: '#fff7ed', charSpacing: 400 },
      { t: 'text', text: 'Small steps\nevery day', x: 0.5, y: 0.47, w: 0.85, size: 0.14, font: 'Poppins', weight: '800', fill: '#ffffff', lh: 1 },
      { t: 'shape', shape: 'arrowline', x: 0.5, y: 0.72, s: 0.15, fill: '#ffffff' },
      { t: 'text', text: '@yourhandle', x: 0.5, y: 0.88, size: 0.03, font: 'Montserrat', fill: '#ffedd5' },
    ],
  },
  {
    name: 'Photo Collage', cat: 'Lifestyle',
    bg: { color: '#ffffff' },
    items: [
      { t: 'photo', x: 0.27, y: 0.31, w: 0.48, h: 0.56, fill: '#d4d4d8' },
      { t: 'photo', x: 0.75, y: 0.18, w: 0.44, h: 0.3, fill: '#e4e4e7' },
      { t: 'photo', x: 0.75, y: 0.5, w: 0.44, h: 0.3, fill: '#d4d4d8' },
      { t: 'rect', x: 0.5, y: 0.83, w: 0.96, h: 0.24, fill: '#18181b' },
      { t: 'text', text: 'Weekend Diaries', x: 0.5, y: 0.8, size: 0.08, font: 'Caveat', weight: '700', fill: '#ffffff' },
      { t: 'text', text: 'COFFEE · BOOKS · SUNSETS', x: 0.5, y: 0.89, size: 0.028, font: 'Montserrat', weight: '700', fill: '#a1a1aa', charSpacing: 400 },
    ],
  },
  {
    name: 'Fashion Drop', cat: 'Fashion',
    bg: { color: '#27272a' },
    items: [
      { t: 'photo', x: 0.5, y: 0.5, w: 1, h: 1, fill: '#52525b' },
      { t: 'rect', x: 0.5, y: 0.78, w: 1, h: 0.44, fill: 'rgba(0,0,0,0.55)' },
      { t: 'text', text: 'NEW DROP', x: 0.5, y: 0.7, size: 0.15, font: 'Bebas Neue', fill: '#ffffff', charSpacing: 150 },
      { t: 'text', text: 'The Fall Collection', x: 0.5, y: 0.82, size: 0.05, font: 'Playfair Display', style: 'italic', fill: '#e4e4e7' },
      { t: 'text', text: 'LINK IN BIO', x: 0.5, y: 0.92, size: 0.028, font: 'Montserrat', weight: '700', fill: '#fbbf24', charSpacing: 500 },
    ],
  },
  {
    name: 'Workshop', cat: 'Event',
    bg: { color: '#eef2ff' },
    items: [
      { t: 'circle', x: 0.8, y: 0.18, r: 0.12, fill: '#4f46e5' },
      { t: 'text', text: 'MAR\n14', x: 0.8, y: 0.18, size: 0.05, font: 'Inter', weight: '800', fill: '#ffffff', lh: 1 },
      { t: 'text', text: 'FREE WORKSHOP', x: 0.42, y: 0.38, w: 0.74, size: 0.035, font: 'Inter', weight: '800', fill: '#4f46e5', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'Watercolor for Beginners', x: 0.42, y: 0.52, w: 0.74, size: 0.085, font: 'DM Serif Display', fill: '#1e1b4b', align: 'left' },
      { t: 'text', text: '10 AM – 1 PM · Community Studio\nAll materials included', x: 0.42, y: 0.7, w: 0.74, size: 0.035, font: 'Inter', fill: '#4338ca', align: 'left', lh: 1.4 },
      { t: 'rect', x: 0.24, y: 0.87, w: 0.38, h: 0.08, fill: '#4f46e5', rx: 0.04 },
      { t: 'text', text: 'Register free', x: 0.24, y: 0.87, size: 0.032, font: 'Inter', weight: '700', fill: '#fff' },
    ],
  },
  {
    name: 'Discount Code', cat: 'Sale',
    bg: { color: '#dcfce7' },
    items: [
      { t: 'rect', x: 0.5, y: 0.5, w: 0.82, h: 0.6, fill: '#ffffff', rx: 0.03 },
      { t: 'rect', x: 0.5, y: 0.5, w: 0.76, h: 0.54, fill: 'transparent', stroke: '#16a34a', strokeW: 0.004, rx: 0.02 },
      { t: 'text', text: '20% OFF', x: 0.5, y: 0.35, size: 0.13, font: 'Archivo Black', fill: '#15803d' },
      { t: 'text', text: 'USE CODE', x: 0.5, y: 0.5, size: 0.03, font: 'Inter', weight: '700', fill: '#4b5563', charSpacing: 400 },
      { t: 'rect', x: 0.5, y: 0.61, w: 0.5, h: 0.1, fill: '#15803d', rx: 0.02 },
      { t: 'text', text: 'ARTVAS20', x: 0.5, y: 0.61, size: 0.06, font: 'Courier New', weight: 'bold', fill: '#ffffff', charSpacing: 200 },
      { t: 'text', text: 'Valid until Sunday', x: 0.5, y: 0.9, size: 0.03, font: 'Inter', fill: '#166534' },
    ],
  },
  {
    name: 'Self-care Reminder', cat: 'Lifestyle',
    bg: { gradient: ['#fbcfe8', '#ddd6fe'] },
    items: [
      { t: 'shape', shape: 'blob', x: 0.5, y: 0.5, s: 0.8, fill: 'rgba(255,255,255,0.55)' },
      { t: 'emoji', text: '🌸', x: 0.5, y: 0.25, size: 0.12 },
      { t: 'text', text: 'gentle reminder', x: 0.5, y: 0.42, size: 0.07, font: 'Caveat', weight: '700', fill: '#9d174d' },
      { t: 'text', text: 'drink water,\nrest, and be kind\nto yourself', x: 0.5, y: 0.6, w: 0.7, size: 0.06, font: 'Poppins', weight: '600', fill: '#4c1d95', lh: 1.2 },
    ],
  },
];

const YT = [
  {
    name: 'Reaction Thumbnail', cat: 'Vlog',
    bg: { color: '#facc15' },
    items: [
      { t: 'photo', x: 0.76, y: 0.55, w: 0.46, h: 0.9, rx: 0.04, fill: '#a16207' },
      { t: 'text', text: "YOU WON'T\nBELIEVE\nTHIS", x: 0.3, y: 0.5, w: 0.56, size: 0.2, font: 'Anton', fill: '#ffffff', stroke: '#111827', strokeW: 0.014, align: 'left', lh: 0.95 },
      { t: 'shape', shape: 'arrow', x: 0.55, y: 0.78, s: 0.22, fill: '#ef4444', angle: -20 },
    ],
  },
  {
    name: 'Tech Review', cat: 'Tech',
    bg: { gradient: ['#020617', '#1e3a8a'] },
    items: [
      { t: 'circle', x: 0.75, y: 0.5, r: 0.45, fill: 'rgba(59,130,246,0.25)' },
      { t: 'photo', x: 0.75, y: 0.5, w: 0.36, h: 0.78, rx: 0.04, fill: '#334155' },
      { t: 'rect', x: 0.16, y: 0.2, w: 0.22, h: 0.12, fill: '#22d3ee', rx: 0.02 },
      { t: 'text', text: 'HONEST', x: 0.16, y: 0.2, size: 0.07, font: 'Bebas Neue', fill: '#020617', charSpacing: 100 },
      { t: 'text', text: 'NEW PHONE\nREVIEW', x: 0.3, y: 0.53, w: 0.55, size: 0.18, font: 'Bebas Neue', fill: '#ffffff', align: 'left', lh: 0.95 },
      { t: 'text', text: 'Worth it in 2027?', x: 0.3, y: 0.83, w: 0.55, size: 0.07, font: 'Inter', weight: '800', fill: '#fbbf24', align: 'left' },
    ],
  },
  {
    name: 'Gaming Epic Win', cat: 'Gaming',
    bg: { gradient: ['#7c3aed', '#2563eb'] },
    items: [
      { t: 'shape', shape: 'burst', x: 0.7, y: 0.5, s: 1.1, fill: 'rgba(250,204,21,0.9)' },
      { t: 'photo', x: 0.2, y: 0.55, w: 0.36, h: 0.9, rx: 0.03, fill: '#4c1d95' },
      { t: 'text', text: 'EPIC\nWIN!', x: 0.7, y: 0.5, w: 0.5, size: 0.3, font: 'Anton', fill: '#ffffff', stroke: '#1e1b4b', strokeW: 0.015, lh: 0.9, angle: -6 },
      { t: 'emoji', text: '🎮', x: 0.92, y: 0.15, size: 0.16 },
    ],
  },
  {
    name: 'How-To Tutorial', cat: 'Education',
    bg: { color: '#ffffff' },
    items: [
      { t: 'rect', x: 0.2, y: 0.5, w: 0.4, h: 1, fill: '#10b981' },
      { t: 'photo', x: 0.25, y: 0.5, w: 0.36, h: 0.74, rx: 0.03, fill: '#a7f3d0' },
      { t: 'text', text: 'HOW TO', x: 0.71, y: 0.2, w: 0.52, size: 0.08, font: 'Montserrat', weight: '900', fill: '#10b981', align: 'left', charSpacing: 200 },
      { t: 'text', text: 'Edit Photos\nLike a Pro', x: 0.71, y: 0.5, w: 0.52, size: 0.12, font: 'Montserrat', weight: '900', fill: '#0f172a', align: 'left', lh: 1 },
      { t: 'circle', x: 0.9, y: 0.82, r: 0.12, fill: '#f43f5e' },
      { t: 'text', text: '5 MIN', x: 0.9, y: 0.82, size: 0.06, font: 'Montserrat', weight: '900', fill: '#ffffff' },
    ],
  },
  {
    name: 'Top 10 List', cat: 'Entertainment',
    bg: { color: '#09090b' },
    items: [
      { t: 'text', text: '10', x: 0.19, y: 0.5, w: 0.38, size: 0.58, font: 'Archivo Black', fill: 'transparent', stroke: '#facc15', strokeW: 0.012 },
      { t: 'text', text: 'THINGS YOU\nNEED TO KNOW', x: 0.6, y: 0.5, w: 0.36, size: 0.12, font: 'Bebas Neue', fill: '#ffffff', align: 'left', lh: 1 },
      { t: 'photo', x: 0.88, y: 0.5, w: 0.22, h: 0.8, rx: 0.03, fill: '#3f3f46' },
    ],
  },
  {
    name: 'Day in My Life', cat: 'Vlog',
    bg: { color: '#78716c' },
    items: [
      { t: 'photo', x: 0.5, y: 0.5, w: 1, h: 1, fill: '#a8a29e' },
      { t: 'rect', x: 0.25, y: 0.5, w: 0.5, h: 1, fill: 'rgba(0,0,0,0.45)' },
      { t: 'text', text: 'A DAY\nIN MY LIFE', x: 0.25, y: 0.48, w: 0.45, size: 0.15, font: 'Poppins', weight: '800', fill: '#ffffff', lh: 1 },
      { t: 'text', text: 'vlog 07', x: 0.25, y: 0.75, size: 0.08, font: 'Caveat', weight: '700', fill: '#fde68a' },
      { t: 'emoji', text: '☀️', x: 0.42, y: 0.18, size: 0.12 },
    ],
  },
  {
    name: 'Quick Recipe', cat: 'Food',
    bg: { color: '#fb923c' },
    items: [
      { t: 'circle', x: 0.72, y: 0.52, r: 0.46, fill: '#fed7aa' },
      { t: 'photo', x: 0.72, y: 0.52, r: 0.4, fill: '#fdba74' },
      { t: 'text', text: 'EASY\n10-MIN\nPASTA', x: 0.24, y: 0.5, w: 0.44, size: 0.17, font: 'Anton', fill: '#ffffff', stroke: '#7c2d12', strokeW: 0.01, align: 'left', lh: 0.95 },
      { t: 'emoji', text: '🍝', x: 0.42, y: 0.84, size: 0.14 },
    ],
  },
  {
    name: 'Full Body Workout', cat: 'Fitness',
    bg: { gradient: ['#18181b', '#991b1b'] },
    items: [
      { t: 'photo', x: 0.76, y: 0.5, w: 0.48, h: 1, fill: '#3f3f46' },
      { t: 'text', text: '15 MIN', x: 0.28, y: 0.27, w: 0.5, size: 0.15, font: 'Bebas Neue', fill: '#f87171', align: 'left' },
      { t: 'text', text: 'FULL BODY\nWORKOUT', x: 0.28, y: 0.55, w: 0.5, size: 0.16, font: 'Bebas Neue', fill: '#ffffff', align: 'left', lh: 0.95 },
      { t: 'rect', x: 0.2, y: 0.84, w: 0.34, h: 0.11, fill: '#facc15', rx: 0.02 },
      { t: 'text', text: 'NO EQUIPMENT', x: 0.2, y: 0.84, size: 0.055, font: 'Bebas Neue', fill: '#18181b', charSpacing: 100 },
    ],
  },
  {
    name: 'Travel Guide', cat: 'Travel',
    bg: { color: '#0369a1' },
    items: [
      { t: 'photo', x: 0.5, y: 0.5, w: 1, h: 1, fill: '#38bdf8' },
      { t: 'text', text: 'ISLAND', x: 0.5, y: 0.42, size: 0.3, font: 'Anton', fill: '#ffffff', shadow: 'rgba(0,0,0,0.5)', charSpacing: 100 },
      { t: 'rect', x: 0.5, y: 0.7, w: 0.5, h: 0.13, fill: '#fde047', rx: 0.02 },
      { t: 'text', text: 'TRAVEL GUIDE', x: 0.5, y: 0.7, size: 0.075, font: 'Montserrat', weight: '900', fill: '#0c4a6e', charSpacing: 200 },
      { t: 'emoji', text: '✈️', x: 0.88, y: 0.15, size: 0.14 },
    ],
  },
  {
    name: 'Money Tips', cat: 'Finance',
    bg: { gradient: ['#064e3b', '#16a34a'] },
    items: [
      { t: 'text', text: 'HOW I SAVED', x: 0.32, y: 0.22, w: 0.6, size: 0.08, font: 'Montserrat', weight: '900', fill: '#bbf7d0', align: 'left', charSpacing: 100 },
      { t: 'text', text: '$10K', x: 0.32, y: 0.5, w: 0.6, size: 0.36, font: 'Archivo Black', fill: '#ffffff', align: 'left', shadow: 'rgba(0,0,0,0.3)' },
      { t: 'text', text: 'in 6 months', x: 0.32, y: 0.8, w: 0.6, size: 0.08, font: 'Caveat', weight: '700', fill: '#fde047', align: 'left' },
      { t: 'emoji', text: '💰', x: 0.8, y: 0.45, size: 0.35 },
      { t: 'emoji', text: '📈', x: 0.92, y: 0.82, size: 0.14 },
    ],
  },
  {
    name: 'Podcast Episode', cat: 'Podcast',
    bg: { color: '#1c1917' },
    items: [
      { t: 'photo', x: 0.16, y: 0.55, r: 0.24, fill: '#57534e' },
      { t: 'photo', x: 0.84, y: 0.55, r: 0.24, fill: '#44403c' },
      { t: 'rect', x: 0.5, y: 0.14, w: 0.18, h: 0.1, fill: '#f97316', rx: 0.02 },
      { t: 'text', text: 'EP. 42', x: 0.5, y: 0.14, size: 0.06, font: 'Space Grotesk', weight: '700', fill: '#1c1917' },
      { t: 'text', text: 'Building a\nBrand From\nZero', x: 0.5, y: 0.58, w: 0.4, size: 0.095, font: 'Space Grotesk', weight: '700', fill: '#fafaf9', lh: 1 },
    ],
  },
  {
    name: 'Versus Comparison', cat: 'Tech',
    bg: { color: '#111827' },
    items: [
      { t: 'rect', x: 0.25, y: 0.5, w: 0.5, h: 1, fill: '#2563eb' },
      { t: 'rect', x: 0.75, y: 0.5, w: 0.5, h: 1, fill: '#dc2626' },
      { t: 'photo', x: 0.25, y: 0.45, w: 0.34, h: 0.6, rx: 0.03, fill: '#60a5fa' },
      { t: 'photo', x: 0.75, y: 0.45, w: 0.34, h: 0.6, rx: 0.03, fill: '#f87171' },
      { t: 'text', text: 'OLD', x: 0.25, y: 0.87, size: 0.11, font: 'Anton', fill: '#ffffff' },
      { t: 'text', text: 'NEW', x: 0.75, y: 0.87, size: 0.11, font: 'Anton', fill: '#ffffff' },
      { t: 'circle', x: 0.5, y: 0.45, r: 0.14, fill: '#facc15' },
      { t: 'text', text: 'VS', x: 0.5, y: 0.45, size: 0.13, font: 'Anton', fill: '#111827' },
    ],
  },
  {
    name: 'Breaking News', cat: 'News',
    bg: { color: '#0f172a' },
    items: [
      { t: 'photo', x: 0.72, y: 0.42, w: 0.56, h: 0.84, fill: '#334155' },
      { t: 'rect', x: 0.5, y: 0.86, w: 1, h: 0.28, fill: '#dc2626' },
      { t: 'rect', x: 0.13, y: 0.72, w: 0.24, h: 0.1, fill: '#ffffff' },
      { t: 'text', text: 'BREAKING', x: 0.13, y: 0.72, size: 0.065, font: 'Bebas Neue', fill: '#dc2626', charSpacing: 150 },
      { t: 'text', text: 'EVERYTHING JUST CHANGED', x: 0.5, y: 0.88, w: 0.95, size: 0.11, font: 'Bebas Neue', fill: '#ffffff', align: 'left' },
      { t: 'text', text: 'What\nhappened?', x: 0.22, y: 0.33, w: 0.4, size: 0.12, font: 'Inter', weight: '800', fill: '#ffffff', align: 'left', lh: 1 },
    ],
  },
  {
    name: 'Study With Me', cat: 'Education',
    bg: { gradient: ['#fef9c3', '#bfdbfe'] },
    items: [
      { t: 'photo', x: 0.73, y: 0.5, w: 0.46, h: 0.8, rx: 0.04, fill: '#cbd5e1' },
      { t: 'text', text: 'study\nwith me', x: 0.27, y: 0.42, w: 0.48, size: 0.17, font: 'Caveat', weight: '700', fill: '#1e3a8a', lh: 0.9 },
      { t: 'rect', x: 0.27, y: 0.78, w: 0.36, h: 0.12, fill: '#1e3a8a', rx: 0.06 },
      { t: 'text', text: '⏰ 2 HOURS', x: 0.27, y: 0.78, size: 0.06, font: 'Poppins', weight: '700', fill: '#ffffff' },
      { t: 'emoji', text: '📚', x: 0.06, y: 0.12, size: 0.12 },
    ],
  },
];

const STORY = [
  {
    name: 'Story Sale', cat: 'Sale',
    bg: { gradient: ['#111827', '#4c1d95'], angle: 90 },
    items: [
      { t: 'photo', x: 0.5, y: 0.36, w: 0.84, h: 0.42, rx: 0.05, fill: '#6d28d9' },
      { t: 'text', text: 'SUMMER', x: 0.5, y: 0.625, size: 0.1, font: 'Bebas Neue', fill: '#c4b5fd', charSpacing: 300 },
      { t: 'text', text: 'SALE', x: 0.5, y: 0.755, size: 0.26, font: 'Anton', fill: '#ffffff' },
      { t: 'rect', x: 0.5, y: 0.88, w: 0.6, h: 0.05, fill: '#facc15', rx: 0.05 },
      { t: 'text', text: 'SWIPE UP · 50% OFF', x: 0.5, y: 0.88, size: 0.045, font: 'Montserrat', weight: '900', fill: '#111827' },
    ],
  },
  {
    name: 'Ask Me Anything', cat: 'Social',
    bg: { gradient: ['#fb7185', '#f59e0b'], angle: 90 },
    items: [
      { t: 'photo', x: 0.5, y: 0.25, r: 0.3, fill: '#fecdd3' },
      { t: 'rect', x: 0.5, y: 0.6, w: 0.84, h: 0.2, fill: '#ffffff', rx: 0.06 },
      { t: 'text', text: 'ASK ME\nANYTHING', x: 0.5, y: 0.6, size: 0.1, font: 'Poppins', weight: '800', fill: '#e11d48', lh: 1 },
      { t: 'text', text: 'drop your questions below 👇', x: 0.5, y: 0.78, w: 0.85, size: 0.055, font: 'Caveat', weight: '700', fill: '#ffffff' },
    ],
  },
  {
    name: 'New Post Alert', cat: 'Social',
    bg: { color: '#f5f5f4' },
    items: [
      { t: 'text', text: 'NEW POST', x: 0.5, y: 0.12, size: 0.13, font: 'Archivo Black', fill: '#1c1917' },
      { t: 'photo', x: 0.5, y: 0.47, w: 0.8, h: 0.45, rx: 0.03, fill: '#d6d3d1' },
      { t: 'shape', shape: 'heart', x: 0.82, y: 0.73, s: 0.16, fill: '#ef4444' },
      { t: 'text', text: 'tap to see it ↓', x: 0.5, y: 0.85, size: 0.07, font: 'Caveat', weight: '700', fill: '#57534e' },
    ],
  },
];

const PRES = [
  {
    name: 'Pitch Deck Title', cat: 'Business',
    bg: { color: '#0b1120' },
    items: [
      { t: 'shape', shape: 'blob', x: 0.85, y: 0.25, s: 0.9, fill: '#4f46e5', opacity: 0.6 },
      { t: 'shape', shape: 'circle', x: 0.95, y: 0.85, s: 0.4, fill: '#ec4899', opacity: 0.6 },
      { t: 'text', text: 'COMPANY · 2027', x: 0.32, y: 0.28, w: 0.55, size: 0.035, font: 'Space Grotesk', weight: '700', fill: '#818cf8', align: 'left', charSpacing: 400 },
      { t: 'text', text: 'The future of\nsmall business', x: 0.32, y: 0.5, w: 0.55, size: 0.11, font: 'Space Grotesk', weight: '700', fill: '#ffffff', align: 'left', lh: 1.05 },
      { t: 'text', text: 'Investor presentation', x: 0.32, y: 0.73, w: 0.55, size: 0.04, font: 'Inter', fill: '#94a3b8', align: 'left' },
    ],
  },
  {
    name: 'Agenda Slide', cat: 'Business',
    bg: { color: '#ffffff' },
    items: [
      { t: 'rect', x: 0.17, y: 0.5, w: 0.34, h: 1, fill: '#f97316' },
      { t: 'text', text: 'Agenda', x: 0.17, y: 0.5, w: 0.3, size: 0.12, font: 'DM Serif Display', fill: '#ffffff' },
      { t: 'text', text: '01   Where we are\n02   What we learned\n03   The plan\n04   Next steps\n05   Q&A', x: 0.66, y: 0.5, w: 0.56, size: 0.055, font: 'Inter', weight: '600', fill: '#1f2937', align: 'left', lh: 1.7 },
    ],
  },
  {
    name: 'Image + Text Slide', cat: 'Education',
    bg: { color: '#f8fafc' },
    items: [
      { t: 'photo', x: 0.27, y: 0.5, w: 0.46, h: 0.82, rx: 0.02, fill: '#cbd5e1' },
      { t: 'text', text: 'KEY INSIGHT', x: 0.74, y: 0.27, w: 0.42, size: 0.03, font: 'Inter', weight: '800', fill: '#0ea5e9', align: 'left', charSpacing: 400 },
      { t: 'text', text: 'Customers come back when it feels personal', x: 0.74, y: 0.45, w: 0.42, size: 0.07, font: 'Inter', weight: '800', fill: '#0f172a', align: 'left', lh: 1.1 },
      { t: 'text', text: 'Repeat purchases rose 32% after we added handwritten notes to every order.', x: 0.74, y: 0.7, w: 0.42, size: 0.035, font: 'Inter', fill: '#475569', align: 'left', lh: 1.4 },
    ],
  },
];

const POSTER = [
  {
    name: 'Concert Poster', cat: 'Event',
    bg: { gradient: ['#1e1b4b', '#be185d'], angle: 90 },
    items: [
      { t: 'circle', x: 0.5, y: 0.28, r: 0.36, fill: '#fb7185', opacity: 0.85 },
      { t: 'photo', x: 0.5, y: 0.28, r: 0.3, fill: '#9f1239' },
      { t: 'text', text: 'NEON\nNIGHTS', x: 0.5, y: 0.65, w: 0.9, size: 0.2, font: 'Bebas Neue', fill: '#ffffff', lh: 0.9 },
      { t: 'text', text: 'LIVE · SATURDAY 9 PM · THE WAREHOUSE', x: 0.5, y: 0.83, w: 0.95, size: 0.028, font: 'Montserrat', weight: '700', fill: '#fbcfe8', charSpacing: 200 },
      { t: 'text', text: 'Tickets at the door', x: 0.5, y: 0.9, size: 0.03, font: 'Montserrat', fill: '#f9a8d4' },
    ],
  },
  {
    name: 'Grand Opening', cat: 'Business',
    bg: { color: '#fffbeb' },
    items: [
      { t: 'shape', shape: 'burst', x: 0.5, y: 0.21, s: 0.46, fill: '#f59e0b' },
      { t: 'text', text: '🎉', x: 0.5, y: 0.21, size: 0.15, font: 'Inter' },
      { t: 'text', text: 'GRAND\nOPENING', x: 0.5, y: 0.53, w: 0.9, size: 0.17, font: 'Archivo Black', fill: '#78350f', lh: 0.95 },
      { t: 'text', text: 'Free coffee for the first 100 guests', x: 0.5, y: 0.71, w: 0.8, size: 0.045, font: 'Poppins', weight: '600', fill: '#92400e' },
      { t: 'rect', x: 0.5, y: 0.85, w: 0.7, h: 0.07, fill: '#78350f', rx: 0.02 },
      { t: 'text', text: 'SAT, MAY 3 · 9 AM', x: 0.5, y: 0.85, size: 0.045, font: 'Poppins', weight: '800', fill: '#fffbeb', charSpacing: 200 },
    ],
  },
  {
    name: 'Yard Sale Flyer', cat: 'Event',
    bg: { color: '#ecfccb' },
    items: [
      { t: 'text', text: 'YARD\nSALE', x: 0.5, y: 0.22, w: 0.9, size: 0.22, font: 'Permanent Marker', fill: '#365314', lh: 0.95 },
      { t: 'text', text: 'Furniture · Clothes · Toys · Books · Plants', x: 0.5, y: 0.45, w: 0.85, size: 0.045, font: 'Poppins', weight: '600', fill: '#3f6212' },
      { t: 'photo', x: 0.5, y: 0.64, w: 0.84, h: 0.25, rx: 0.02, fill: '#d9f99d' },
      { t: 'text', text: 'SUNDAY 8 AM – 2 PM\n42 Maple Avenue', x: 0.5, y: 0.88, w: 0.85, size: 0.05, font: 'Poppins', weight: '800', fill: '#1a2e05', lh: 1.3 },
    ],
  },
];

const CARD = [
  {
    name: 'Modern Business Card', cat: 'Business',
    bg: { color: '#ffffff' },
    items: [
      { t: 'rect', x: 0.84, y: 0.5, w: 0.32, h: 1, fill: '#4f46e5' },
      { t: 'text', text: 'A', x: 0.84, y: 0.5, size: 0.4, font: 'DM Serif Display', fill: '#ffffff' },
      { t: 'text', text: 'Sam Rivera', x: 0.37, y: 0.3, w: 0.62, size: 0.12, font: 'Inter', weight: '800', fill: '#111827', align: 'left' },
      { t: 'text', text: 'Product Designer', x: 0.37, y: 0.43, w: 0.62, size: 0.06, font: 'Inter', fill: '#4f46e5', align: 'left' },
      { t: 'text', text: 'sam@example.com\n+1 555 0199\nexample.com', x: 0.37, y: 0.74, w: 0.62, size: 0.055, font: 'Inter', fill: '#4b5563', align: 'left', lh: 1.4 },
    ],
  },
  {
    name: 'Bold Business Card', cat: 'Business',
    bg: { gradient: ['#f97316', '#db2777'] },
    items: [
      { t: 'text', text: 'BLOOM\nSTUDIO', x: 0.5, y: 0.42, w: 0.9, size: 0.2, font: 'Archivo Black', fill: '#ffffff', lh: 0.95 },
      { t: 'text', text: 'FLOWERS · EVENTS · GIFTS', x: 0.5, y: 0.78, size: 0.05, font: 'Montserrat', weight: '700', fill: '#ffedd5', charSpacing: 300 },
    ],
  },
];

const INVITE = [
  {
    name: 'Birthday Party Invite', cat: 'Party',
    bg: { gradient: ['#fde68a', '#fca5a5'] },
    items: [
      { t: 'emoji', text: '🎈', x: 0.2, y: 0.13, size: 0.2 },
      { t: 'emoji', text: '🎉', x: 0.82, y: 0.14, size: 0.16 },
      { t: 'text', text: "You're invited", x: 0.5, y: 0.3, size: 0.1, font: 'Pacifico', fill: '#9f1239' },
      { t: 'text', text: "MIA'S 7TH\nBIRTHDAY", x: 0.5, y: 0.48, w: 0.9, size: 0.14, font: 'Archivo Black', fill: '#7c2d12', lh: 1 },
      { t: 'rect', x: 0.5, y: 0.73, w: 0.8, h: 0.2, fill: 'rgba(255,255,255,0.6)', rx: 0.04 },
      { t: 'text', text: 'Saturday, June 14 · 2 PM\n12 Sunny Lane\nRSVP to Anna · 555-0123', x: 0.5, y: 0.73, w: 0.75, size: 0.045, font: 'Poppins', weight: '600', fill: '#7c2d12', lh: 1.4 },
      { t: 'emoji', text: '🎂', x: 0.5, y: 0.92, size: 0.12 },
    ],
  },
  {
    name: 'Baby Shower Invite', cat: 'Party',
    bg: { color: '#eff6ff' },
    items: [
      { t: 'shape', shape: 'cloud', x: 0.5, y: 0.22, s: 0.55, fill: '#ffffff' },
      { t: 'emoji', text: '🍼', x: 0.5, y: 0.22, size: 0.14 },
      { t: 'text', text: 'Baby Shower', x: 0.5, y: 0.45, w: 0.9, size: 0.13, font: 'Great Vibes', fill: '#1d4ed8' },
      { t: 'text', text: 'HONORING EMMA', x: 0.5, y: 0.57, size: 0.045, font: 'Montserrat', weight: '700', fill: '#1e3a8a', charSpacing: 400 },
      { t: 'text', text: 'Sunday, April 6 · 1 PM\nThe Garden Room', x: 0.5, y: 0.72, w: 0.8, size: 0.05, font: 'Lora', fill: '#1e40af', lh: 1.4 },
      { t: 'text', text: '★ ☆ ★', x: 0.5, y: 0.88, size: 0.06, font: 'Arial', fill: '#93c5fd' },
    ],
  },
];

const RESUME = [
  {
    name: 'Clean Resume', cat: 'Business',
    bg: { color: '#ffffff' },
    items: [
      { t: 'rect', x: 0.16, y: 0.5, w: 0.32, h: 1, fill: '#1e293b' },
      { t: 'photo', x: 0.16, y: 0.13, r: 0.11, fill: '#475569' },
      { t: 'text', text: 'CONTACT\n\nalex@example.com\n+1 555 0100\nexample.com\nYour City', x: 0.16, y: 0.36, w: 0.26, size: 0.022, font: 'Inter', fill: '#e2e8f0', align: 'left', lh: 1.6 },
      { t: 'text', text: 'SKILLS\n\nBrand design\nTypography\nIllustration\nMotion graphics\nPresentation', x: 0.16, y: 0.62, w: 0.26, size: 0.022, font: 'Inter', fill: '#e2e8f0', align: 'left', lh: 1.6 },
      { t: 'text', text: 'Alex Morgan', x: 0.64, y: 0.08, w: 0.6, size: 0.06, font: 'DM Serif Display', fill: '#0f172a', align: 'left' },
      { t: 'text', text: 'GRAPHIC DESIGNER', x: 0.64, y: 0.13, w: 0.6, size: 0.022, font: 'Inter', weight: '700', fill: '#0ea5e9', align: 'left', charSpacing: 400 },
      { t: 'text', text: 'PROFILE', x: 0.64, y: 0.21, w: 0.6, size: 0.022, font: 'Inter', weight: '800', fill: '#0f172a', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'Designer with 6 years of experience creating brands, campaigns and digital products for small businesses and startups.', x: 0.64, y: 0.27, w: 0.6, size: 0.02, font: 'Inter', fill: '#475569', align: 'left', lh: 1.5 },
      { t: 'text', text: 'EXPERIENCE', x: 0.64, y: 0.37, w: 0.6, size: 0.022, font: 'Inter', weight: '800', fill: '#0f172a', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'Senior Designer · Studio North\n2023 – Present\nLed rebrands for 20+ clients and built the studio design system.\n\nDesigner · Bright Agency\n2020 – 2023\nCreated social campaigns reaching 2M+ people.', x: 0.64, y: 0.52, w: 0.6, size: 0.02, font: 'Inter', fill: '#475569', align: 'left', lh: 1.5 },
      { t: 'text', text: 'EDUCATION', x: 0.64, y: 0.7, w: 0.6, size: 0.022, font: 'Inter', weight: '800', fill: '#0f172a', align: 'left', charSpacing: 300 },
      { t: 'text', text: 'BA Graphic Design · City University\n2016 – 2020', x: 0.64, y: 0.75, w: 0.6, size: 0.02, font: 'Inter', fill: '#475569', align: 'left', lh: 1.5 },
    ],
  },
];

const LOGO = [
  {
    name: 'Badge Logo', cat: 'Logo',
    bg: { color: '#ffffff' },
    items: [
      { t: 'circle', x: 0.5, y: 0.5, r: 0.42, fill: '#1f2937' },
      { t: 'circle', x: 0.5, y: 0.5, r: 0.36, fill: 'transparent' },
      { t: 'shape', shape: 'ring', x: 0.5, y: 0.5, s: 0.76, fill: '#f59e0b' },
      { t: 'text', text: 'OAK &\nIRON', x: 0.5, y: 0.47, w: 0.6, size: 0.12, font: 'Abril Fatface', fill: '#ffffff', lh: 1 },
      { t: 'text', text: 'EST. 2027', x: 0.5, y: 0.66, size: 0.045, font: 'Montserrat', weight: '700', fill: '#f59e0b', charSpacing: 300 },
    ],
  },
  {
    name: 'Monogram Logo', cat: 'Logo',
    bg: { color: '#fdf2f8' },
    items: [
      { t: 'shape', shape: 'hexagon', x: 0.5, y: 0.42, s: 0.55, fill: '#be185d' },
      { t: 'text', text: 'LM', x: 0.5, y: 0.42, size: 0.2, font: 'Playfair Display', weight: 'bold', fill: '#ffffff' },
      { t: 'text', text: 'LUNA MAE', x: 0.5, y: 0.8, size: 0.07, font: 'Montserrat', weight: '700', fill: '#831843', charSpacing: 500 },
    ],
  },
  {
    name: 'Leaf Logo', cat: 'Logo',
    bg: { color: '#f0fdf4' },
    items: [
      { t: 'emoji', text: '🌿', x: 0.5, y: 0.36, size: 0.3 },
      { t: 'text', text: 'greenleaf', x: 0.5, y: 0.66, size: 0.13, font: 'Josefin Sans', weight: '700', fill: '#14532d' },
      { t: 'text', text: 'ORGANIC MARKET', x: 0.5, y: 0.77, size: 0.045, font: 'Josefin Sans', fill: '#15803d', charSpacing: 400 },
    ],
  },
];

const FBCOVER = [
  {
    name: 'Business Cover', cat: 'Business',
    bg: { gradient: ['#0f172a', '#1e40af'], angle: 0 },
    items: [
      { t: 'photo', x: 0.8, y: 0.5, w: 0.4, h: 1, fill: '#334155' },
      { t: 'text', text: 'Design that grows\nyour business', x: 0.33, y: 0.45, w: 0.55, size: 0.14, font: 'Poppins', weight: '800', fill: '#ffffff', align: 'left', lh: 1.05 },
      { t: 'text', text: 'Branding · Web · Social', x: 0.33, y: 0.78, w: 0.55, size: 0.06, font: 'Poppins', fill: '#93c5fd', align: 'left' },
    ],
  },
  {
    name: 'Community Cover', cat: 'Social',
    bg: { gradient: ['#f472b6', '#facc15'], angle: 0 },
    items: [
      { t: 'shape', shape: 'blob', x: 0.12, y: 0.3, s: 0.9, fill: 'rgba(255,255,255,0.25)' },
      { t: 'shape', shape: 'blob', x: 0.9, y: 0.8, s: 0.8, fill: 'rgba(255,255,255,0.25)' },
      { t: 'text', text: 'Welcome to the Creators Club', x: 0.5, y: 0.45, w: 0.8, size: 0.15, font: 'Pacifico', fill: '#ffffff', shadow: 'rgba(0,0,0,0.2)' },
      { t: 'text', text: 'SHARE · LEARN · GROW', x: 0.5, y: 0.75, size: 0.06, font: 'Montserrat', weight: '800', fill: '#831843', charSpacing: 400 },
    ],
  },
];

const tag = (arr, fmt) => arr.map((t) => ({ ...t, fmt }));

export const MORE_TEMPLATES = [
  ...tag(IG, 'ig'),
  ...tag(YT, 'yt'),
  ...tag(STORY, 'story'),
  ...tag(PRES, 'pres'),
  ...tag(POSTER, 'poster'),
  ...tag(CARD, 'card'),
  ...tag(INVITE, 'invite'),
  ...tag(RESUME, 'resume'),
  ...tag(LOGO, 'logo'),
  ...tag(FBCOVER, 'fbcover'),
];
