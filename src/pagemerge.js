// Three-way merge of one page's JSON, shared by the browser and the server (no dependencies).
// Objects are matched by their `cid`. Objects the incoming snapshot changed (compared with the
// version it was based on) take the incoming version; everything else keeps the current version.
// Objects added on either side are kept; an object deleted on one side stays deleted unless the
// other side changed it.

const BG_KEYS = ['background', 'backgroundImage', 'overlay', 'overlayImage', 'bgGradient'];

export function mergePage(base, incoming, current) {
  if (!current) return incoming;
  if (!incoming) return current;
  base ||= { objects: [] };
  const str = (o) => JSON.stringify(o ?? null);
  const map = (j) => new Map((j.objects || []).filter((o) => o && o.cid).map((o) => [o.cid, o]));
  const B = map(base);
  const I = map(incoming);
  const C = map(current);
  const changed = (id) => !B.has(id) || str(I.get(id)) !== str(B.get(id));
  const curChanged = (id) => !B.has(id) || str(C.get(id)) !== str(B.get(id));
  const out = { ...current };
  for (const k of BG_KEYS) {
    if (str(incoming[k]) !== str(base[k])) {
      if (incoming[k] === undefined) delete out[k];
      else out[k] = incoming[k];
    }
  }
  const objs = [];
  for (const co of current.objects || []) {
    const id = co?.cid;
    if (id && I.has(id)) objs.push(changed(id) ? I.get(id) : co);
    else if (id && B.has(id) && !curChanged(id)) continue; // deleted by the incoming side
    else objs.push(co); // added (or changed) on the current side
  }
  for (const io of incoming.objects || []) {
    const id = io?.cid;
    if (id && C.has(id)) continue;
    if (!id || !B.has(id)) objs.push(io); // added by the incoming side
    else if (changed(id)) objs.push(io); // deleted on the current side but changed by incoming: keep
  }
  out.objects = objs;
  return out;
}
