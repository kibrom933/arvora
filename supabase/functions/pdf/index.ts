// Fordelingslisten som PDF, lavet på serveren ud fra den gemte fordeling (versionsbundet) og underskrifterne.
// Skrift: Hanken Grotesk (latin + udvidet latin) fra appens fonts-mappe, ellers Helvetica.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { preflight, fail, currentUser, userClient, appUrl } from '../_shared/common.ts';

const kr = (n: number) => Math.round(n).toLocaleString('da-DK') + ' kr.';
const lot = (no: number) => 'Nr. ' + String(no).padStart(3, '0');

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const url = new URL(req.url);
  const runId = url.searchParams.get('run_id') ?? (await req.json().catch(() => ({}))).run_id;
  if (typeof runId !== 'string') return fail('run_id mangler');
  const u = userClient(req); // RLS: kun medlemmer ser frigivne fordelinger
  const { data: run } = await u.from('distribution_runs').select('id, estate_id, version, method, lod, result, created_at').eq('id', runId).maybeSingle();
  if (!run) return fail('Fordelingen findes ikke, eller du har ikke adgang', 404);
  const [{ data: estate }, { data: sigs }, { data: ties }] = await Promise.all([
    u.from('estates').select('name, years, mode').eq('id', run.estate_id).single(),
    u.from('signatures').select('heir_id, signed_name, method, created_at').eq('run_id', runId),
    u.from('tie_break_records').select('note').eq('run_id', runId),
  ]);
  if (!estate) return fail('Boet findes ikke', 404);
  const R = run.result as Record<string, any>;
  const live = estate.mode === 'live';
  const heirs: { id: string; name: string; no_wish: boolean; proxy: boolean }[] = R.heirs ?? [];
  const items: Record<string, { no: number; name: string }> = {}; for (const i of R.items ?? []) items[i.id] = i;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  let font: PDFFont, bold: PDFFont;
  try {
    const base = await appUrl();
    const [a, b] = await Promise.all([fetch(`${base}/fonts/hk-400.ttf`), fetch(`${base}/fonts/hk-700.ttf`)]);
    if (!a.ok || !b.ok) throw new Error('fonts');
    font = await doc.embedFont(await a.arrayBuffer()); bold = await doc.embedFont(await b.arrayBuffer());
  } catch { font = await doc.embedFont(StandardFonts.Helvetica); bold = await doc.embedFont(StandardFonts.HelveticaBold); }
  const safe = (t: string) => { try { font.encodeText(t); return t; } catch { return t.replace(/[^\x20-\x7E -ɏḀ-ỿ–—‘’“”•…]/g, '?'); } };
  let page = doc.addPage([595, 842]); let y = 800;
  page.drawRectangle({ x: 0, y: 822, width: 595, height: 20, color: rgb(0.29, 0.18, 0.37) });
  const line = (t: string, size = 11, f = font, color = rgb(0.17, 0.14, 0.21), indent = 0) => {
    const words = safe(t).split(' '); let cur = '';
    const flush = () => { if (y < 60) { page = doc.addPage([595, 842]); y = 800; } page.drawText(cur, { x: 56 + indent, y, size, font: f, color }); y -= size * 1.45; cur = ''; };
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(test, size) > 480 - indent) { flush(); cur = w; } else cur = test; }
    if (cur) flush();
  };
  line('Fordelingsliste', 22, bold, rgb(0.29, 0.18, 0.37)); y -= 4;
  line((live ? 'Ønskeliste for ' : 'Boet efter ') + estate.name + (estate.years ? ' · ' + estate.years : ''), 13, bold);
  line(`${R.method === 'kroner' ? 'Kronemetoden' : 'Pointmetoden'} · version ${run.version} · ${new Date(run.created_at).toLocaleDateString('da-DK')}`, 10, font, rgb(0.42, 0.39, 0.46)); y -= 8;
  for (const h of heirs) {
    const box = (R.out?.[h.id] ?? []) as { itemId: string; points?: number; price?: number; lod?: boolean; will?: boolean }[];
    line(h.name + (h.proxy ? ' (ønsker indtastet af tovholderen efter aftale)' : ''), 13, bold);
    if (!box.length) line(h.no_wish ? 'Ønskede ikke noget af tingene' : 'Ingen ting', 10.5, font, undefined, 14);
    for (const x of box) { const it = items[x.itemId]; if (!it) continue;
      line(`${lot(it.no)}   ${it.name}${x.will ? '   (testamente)' : ''}${R.method === 'kroner' && !x.will ? '   ' + kr(x.price ?? 0) : ''}${x.lod ? '   (afgjort ved lod)' : ''}`, 10.5, font, undefined, 14); }
    y -= 6;
  }
  if (R.method === 'kroner' && R.settle) { line('Udligning i arven', 13, bold); for (const z of R.settle) { const h = heirs.find(x => x.id === z.heirId); line(`${h?.name ?? ''}: ${z.diff > 0.5 ? 'får ' + kr(z.diff) + ' mindre' : z.diff < -0.5 ? 'får ' + kr(-z.diff) + ' mere' : 'lige op'}`, 10.5, font, undefined, 14); } y -= 6; }
  if (R.rest?.length) { line('Til salg, genbrug eller rydning', 13, bold); for (const id of R.rest) { const it = items[id]; if (it) line(`${lot(it.no)}   ${it.name}`, 10.5, font, undefined, 14); } y -= 6; }
  if (ties?.length) { line('Afgjort ved lodtrækning', 13, bold); for (const t of ties) line(t.note, 10.5, font, undefined, 14); y -= 6; }
  line('Underskrevet', 13, bold);
  for (const h of heirs) { const sg = (sigs ?? []).find(x => x.heir_id === h.id); line(`${h.name}: ${sg ? `${sg.signed_name}, ${new Date(sg.created_at).toLocaleString('da-DK')} (bekræftet med engangskode på ${sg.method === 'otp_email' ? 'mail' : 'SMS'})` : 'mangler'}`, 10.5, font, undefined, 14); }
  y -= 10;
  line((live ? 'Listen kan bruges som grundlag for et indbotestamente hos en advokat. ' : 'Indboets værdi skal stadig med i boopgørelsen til handelsværdi. ') + 'Arvora er en hjælp til at blive enige og ikke juridisk rådgivning. Godkendelsen er en elektronisk bekræftelse med engangskode, ikke en kvalificeret elektronisk signatur.', 8.5, font, rgb(0.42, 0.39, 0.46));
  line(`Dokument-hash ${String(R.document_hash ?? '').slice(0, 16)}… · lod ${run.lod} · motor ${R.engine ?? '1'}`, 8, font, rgb(0.6, 0.57, 0.63));
  const bytes = await doc.save();
  return new Response(bytes as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="fordelingsliste-v${run.version}.pdf"`, 'Access-Control-Allow-Origin': '*' } });
});
