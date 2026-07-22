import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import SmartSearch from '../components/SmartSearch';
import { Printer, QrCode, BookOpen, Box, X, CheckSquare, Square, Trash2, Minus, Plus } from 'lucide-react';

/**
 * Étiquettes QR — prints the label the factory already glues onto each product,
 * enriched with a QR code, an optional RÉSERVÉ stamp and a free note.
 * Two output formats: 80 × 50 mm thermal labels (the Tysso BLP-300) or an A4 sheet.
 *
 * The QR encodes ONLY the `barcode` string (ATL-M-xxxxxx / ATL-P-xxxxxx). Names
 * change over time, the code never does — that is what the scanner will read.
 */

/**
 * Page formats. `cssSize` feeds the @page rule, which is what actually tells the
 * printer the media size — the driver must be set to the same size or it feeds blanks.
 * Layouts are calibrated per format so a QR never overflows its cell: qrMax is the
 * hard ceiling, qrDefault / fontDefault are what you get when you pick the format.
 */
const FORMATS = {
  thermal: {
    label: 'Étiquette thermique 80 × 50 mm',
    short: '80×50',
    pageWord: 'étiquette',
    width: 80, height: 50, pageMargin: 0,
    // Deliberately no cssSize. Chrome infers *landscape* from any @page size whose width
    // exceeds its height, and the driver then rotates the content 90° on a label that is
    // already wide — the name ends up running along the edge and clipped. With no `size`,
    // Chrome uses the printer's own 80 × 50 media in its natural orientation and prints flat.
    cssSize: null,
    tight: true, // every extra block competes with the QR for 46 mm of usable height
    showBorder: false, // die-cut labels are already separated — a cut guide only wastes edge
    previewW: 340,
    // Measured: 46 mm of usable height. A 26 mm QR leaves room for a 3-line name.
    // RÉSERVÉ + note do not fit on top of that — the QR slider is how you make room.
    layouts: {
      1: { rows: 1, label: '1 par étiquette', qrMax: 40, qrMin: 15, qrDefault: 26, nameLines: 2,
           fontMin: 2, fontMax: 8, fontDefault: 3.5, fontStep: 0.5, small: 2, stamp: 3,
           pad: '2mm', gap: '1mm', stampPad: '0.8mm 4mm', stampBorder: '1.5px', notePad: '1mm' },
    },
  },
  a4: {
    label: 'Planche A4 210 × 297 mm',
    short: 'A4',
    pageWord: 'page',
    width: 210, height: 297, pageMargin: 10,
    cssSize: 'A4',
    showBorder: true,
    previewW: 373,
    layouts: {
      1: { rows: 1, label: '1 par page', qrMax: 95, qrMin: 20, qrDefault: 55, nameLines: 3,
           fontMin: 6, fontMax: 30, fontDefault: 16, fontStep: 1, small: 4.5, stamp: 8,
           pad: '8mm', gap: '4mm', stampPad: '2mm 8mm', stampBorder: '3px', notePad: '2mm' },
      2: { rows: 2, label: '2 par page', qrMax: 60, qrMin: 20, qrDefault: 40, nameLines: 3,
           fontMin: 6, fontMax: 22, fontDefault: 12, fontStep: 1, small: 3.5, stamp: 6,
           pad: '6mm', gap: '3mm', stampPad: '2mm 6mm', stampBorder: '2px', notePad: '2mm' },
    },
  },
};
const DEFAULT_FORMAT = 'thermal';
const layoutOf = (fmt, perPage) => fmt.layouts[perPage] ?? Object.values(fmt.layouts)[0];

const MM = 3.7795275591; // px per mm at 96dpi
// Cap only the on-screen preview: rendering hundreds of pages with QR codes
// would freeze the browser. Printing is never capped.
const PREVIEW_MAX = 20;

/**
 * Millimetres left in one label cell for the name and the QR once every fixed-height block
 * is accounted for. Those two then share it, each one's ceiling being the remainder after
 * the other — which is what makes clipping impossible rather than merely unlikely. A clipped
 * QR or a barcode line pushed off the label breaks scanning silently, so no floor is applied:
 * a floor would hand back a size that does not fit.
 *
 * Line factors match what renders: the name carries line-height 1.15 itself, the small texts
 * inherit 1.6 from index.css. The 1.5 mm slack absorbs the gap between screen metrics and
 * the printer's 203 dpi rasteriser — several combinations land within 0.2 mm without it.
 */
const labelBudgetMm = (fmt, cfg, { reserved, note }) => {
  const pxToMm = (v) => parseFloat(v) / MM; // '1.5px' → mm
  const cell = (fmt.height - 2 * fmt.pageMargin) / cfg.rows;
  let blocks = 4; // name, category, QR, barcode line
  let fixed = cfg.small * 1.6  // category
            + cfg.small * 1.6; // barcode line
  if (reserved) {
    fixed += cfg.stamp * 1.1 + 2 * parseFloat(cfg.stampPad) + 2 * pxToMm(cfg.stampBorder);
    blocks++;
  }
  if (note) {
    fixed += cfg.small * 1.6 + parseFloat(cfg.notePad) + pxToMm('1px'); // + its top border
    blocks++;
  }
  fixed += parseFloat(cfg.gap) * (blocks - 1) + 2 * parseFloat(cfg.pad) + 1.5;
  return cell - fixed;
};
// The name is clamped to nameLines, so this is the most it can ever occupy.
const nameHeightMm = (cfg, fontMm) => fontMm * 1.15 * cfg.nameLines;

// One printed label. Always black on white so the dark theme can't ruin a printout.
export function LabelCard({ item, fontSize, qrSize, showReserved, note, perPage, format = DEFAULT_FORMAT }) {
  const fmt = FORMATS[format];
  const cfg = layoutOf(fmt, perPage);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', height: '100%', width: '100%', boxSizing: 'border-box',
      padding: cfg.pad, background: '#fff', color: '#000',
      border: fmt.showBorder ? '1px dashed #bbb' : 'none', overflow: 'hidden', gap: cfg.gap,
    }}>
      {showReserved && (
        <div style={{
          border: `${cfg.stampBorder} solid #000`, padding: cfg.stampPad, fontWeight: 900, letterSpacing: '2px',
          fontSize: `${cfg.stamp}mm`, transform: 'rotate(-3deg)', lineHeight: 1.1, flexShrink: 0,
        }}>
          RÉSERVÉ
        </div>
      )}

      {/* Clamped to nameLines: the name is the only variable-height block, so bounding it
          is what makes the QR ceiling below a guarantee rather than an estimate. */}
      <div style={{
        fontSize: `${fontSize}mm`, fontWeight: 800, lineHeight: 1.15, wordBreak: 'break-word', width: '100%',
        maxHeight: `${(cfg.nameLines * 1.15).toFixed(2)}em`, overflow: 'hidden', flexShrink: 0,
      }}>
        {item.name}
      </div>

      {item.category && (
        <div style={{ fontSize: `${cfg.small}mm`, letterSpacing: '1px', textTransform: 'uppercase', flexShrink: 0 }}>
          {item.category}{item._kind === 'material' && item.unit ? ` · ${item.unit}` : ''}
        </div>
      )}

      <QRCodeSVG value={item.barcode || ''} size={qrSize * MM} level="M" marginSize={0} style={{ flexShrink: 0 }} />

      <div style={{ fontSize: `${cfg.small}mm`, fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 700, flexShrink: 0 }}>
        {item.barcode}
      </div>

      {note.trim() && (
        <div style={{ fontSize: `${cfg.small}mm`, borderTop: '1px solid #000', paddingTop: cfg.notePad, width: '90%', wordBreak: 'break-word' }}>
          {note}
        </div>
      )}
    </div>
  );
}

// One physical sheet — an A4 page or a single thermal label — holding `perPage` labels.
export function PrintPage({ items, fontSize, qrSize, showReserved, note, perPage, isLast, format = DEFAULT_FORMAT }) {
  const fmt = FORMATS[format];
  const cfg = layoutOf(fmt, perPage);
  return (
    <div
      className="atlas-page"
      style={{
        width: `${fmt.width}mm`, height: `${fmt.height}mm`, boxSizing: 'border-box',
        padding: `${fmt.pageMargin}mm`,
        background: '#fff', display: 'grid', gridTemplateRows: `repeat(${cfg.rows}, minmax(0, 1fr))`,
        pageBreakAfter: isLast ? 'auto' : 'always', breakAfter: isLast ? 'auto' : 'page',
        overflow: 'hidden',
      }}
    >
      {/* index-keyed: the same label can legitimately repeat on a page */}
      {items.map((it, i) => (
        <LabelCard key={i} item={it} fontSize={fontSize} qrSize={qrSize}
                   showReserved={showReserved} note={note} perPage={perPage} format={format} />
      ))}
    </div>
  );
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const keyOf = (kind, id) => `${kind}:${id}`;
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export default function Labels() {
  const [tab, setTab] = useState('models'); // 'models' | 'materials'
  const [models, setModels] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  // Selection survives tab switches and searches: keyed map holding the item itself.
  const [selected, setSelected] = useState(() => new Map());

  // print modal state
  const [printItems, setPrintItems] = useState(null);
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [perPage, setPerPage] = useState(1);
  const [fontSize, setFontSize] = useState(() => layoutOf(FORMATS[DEFAULT_FORMAT], 1).fontDefault); // mm
  const [qrSize, setQrSize] = useState(() => layoutOf(FORMATS[DEFAULT_FORMAT], 1).qrDefault);       // mm
  const [showReserved, setShowReserved] = useState(false);
  const [note, setNote] = useState('');
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([api.get('/product-models'), api.get('/materials')]);
        setModels(m.data || []);
        setMaterials(p.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt = FORMATS[format];
  const cfg = layoutOf(fmt, Number(perPage));
  // Clamped during render, not in an effect: going from 2-per-page to 1-per-page must never
  // leave a QR wider than its cell, and an effect doing setState would cascade a re-render.
  // Ceilings, not fixed maximums: they shrink as RÉSERVÉ and the note eat into the height,
  // so neither slider can ever ask for something that would clip the barcode line off.
  // The name yields first — a truncated name is cosmetic, an unscannable QR is not.
  const freeMm = labelBudgetMm(fmt, cfg, { reserved: showReserved, note: !!note.trim() });
  const fontCeil = Math.max(
    cfg.fontMin,
    Math.floor((freeMm - cfg.qrMin) / (1.15 * cfg.nameLines) / cfg.fontStep) * cfg.fontStep,
  );
  const fontTop = Math.min(cfg.fontMax, fontCeil);
  const fontMm = Math.min(Math.max(fontSize, cfg.fontMin), fontTop);
  const qrCeil = Math.max(cfg.qrMin, Math.min(cfg.qrMax, Math.floor(freeMm - nameHeightMm(cfg, fontMm))));
  const qrMm = Math.min(qrSize, qrCeil);
  // Preview: scale the real mm size to a fixed pixel width — down for A4, up for a small label.
  const previewScale = fmt.previewW / (fmt.width * MM);
  const previewH = Math.round(fmt.height * MM * previewScale);
  const pageWordCap = fmt.pageWord.charAt(0).toUpperCase() + fmt.pageWord.slice(1);

  // Switching format resets the sizes: a 16 mm name is right on A4 and absurd on an 80×50 label.
  const changeFormat = (key) => {
    const next = FORMATS[key];
    const nextPerPage = next.layouts[perPage] ? perPage : Number(Object.keys(next.layouts)[0]);
    const c = layoutOf(next, nextPerPage);
    setFormat(key);
    setPerPage(nextPerPage);
    setFontSize(c.fontDefault);
    setQrSize(c.qrDefault);
  };

  const rows = tab === 'models' ? models : materials;
  const kind = tab === 'models' ? 'model' : 'material';

  const catFilters = useMemo(() => {
    const cats = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();
    if (!cats.length) return [];
    return [{ key: 'category', label: 'Catégorie', options: cats.map(c => ({ value: c, label: c })) }];
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (activeFilters.category && r.category !== activeFilters.category) return false;
    const s = searchText.trim().toLowerCase();
    if (!s) return true;
    return r.name?.toLowerCase().includes(s)
        || r.barcode?.toLowerCase().includes(s)
        || r.category?.toLowerCase().includes(s);
  }), [rows, searchText, activeFilters]);

  const isSel = (r) => selected.has(keyOf(kind, r.id));

  const toggle = (r) => setSelected(prev => {
    const next = new Map(prev);
    const k = keyOf(kind, r.id);
    if (next.has(k)) next.delete(k);
    else next.set(k, { ...r, _kind: kind });
    return next;
  });

  const removeKey = (k) => setSelected(prev => {
    const next = new Map(prev);
    next.delete(k);
    return next;
  });

  const allShownSelected = filtered.length > 0 && filtered.every(isSel);
  const toggleAll = () => setSelected(prev => {
    const next = new Map(prev);
    if (allShownSelected) filtered.forEach(r => next.delete(keyOf(kind, r.id)));
    else filtered.forEach(r => next.set(keyOf(kind, r.id), { ...r, _kind: kind }));
    return next;
  });

  const openPrint = (items) => {
    const usable = items.filter(i => i.barcode);
    const skipped = items.length - usable.length;
    if (!usable.length) {
      alert("Aucun des éléments sélectionnés n'a de code QR. Rechargez la page (le serveur doit être à jour).");
      return;
    }
    if (skipped > 0) {
      alert(`${skipped} élément(s) ignoré(s) car ils n'ont pas de code QR. ${usable.length} élément(s) seront imprimés.`);
    }
    setNote('');
    setShowReserved(false);
    setCopies(1);
    setPrintItems(usable);
  };

  // remove a label from the print job without closing the modal
  const dropFromPrint = (barcode) => setPrintItems(prev => {
    const next = prev.filter(i => i.barcode !== barcode);
    if (!next.length) return null;
    return next;
  });

  const selectedList = [...selected.entries()];

  /**
   * Build the flat list of labels to print.
   * [A, B, C] × 2 copies = [A, A, B, B, C, C]
   * Then chunk by perPage to get pages.
   *
   * Auto-fill ONLY when there is exactly 1 unique item with 1 copy — fills the page
   * so the sheet is not wasted. With multiple items, every item gets its own slot.
   */
  const expanded = useMemo(() => {
    if (!printItems || printItems.length === 0) return [];
    const pg = Number(perPage) || 1;
    const list = [];
    // Add each item copies times: [A,A,B,B,C,C] for copies=2
    for (const it of printItems) {
      for (let c = 0; c < copies; c++) {
        list.push(it);
      }
    }
    // Auto-fill ONLY for exactly 1 item with 1 copy (e.g., 1 item, 2-per-page → show twice)
    if (printItems.length === 1 && copies === 1 && list.length < pg) {
      while (list.length < pg) list.push(printItems[0]);
    }
    return list;
  }, [printItems, copies, perPage]);

  const pages = useMemo(() => {
    const pg = Number(perPage) || 1;
    return chunk(expanded, pg);
  }, [expanded, perPage]);

  return (
    <div className="page-transition">
      {/* Printing rules: hide the whole app, show only the portal below. */}
      <style>{`
        .atlas-copies input[type=number] { -moz-appearance: textfield; appearance: textfield; }
        .atlas-copies input[type=number]::-webkit-outer-spin-button,
        .atlas-copies input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        #atlas-print-root { display: none; }
        @media print {
          /* Declaring a size tells the printer the media; omitting it defers to the driver's
             own paper, which is what a wide label needs (see cssSize in FORMATS). */
          @page { ${fmt.cssSize ? `size: ${fmt.cssSize}; ` : ''}margin: 0; }
          /* height matters as much as margin: index.css puts min-height:100vh on body, which
             in print keeps a screen-tall box alive and emits blank pages after the labels. */
          html, body {
            background: #fff !important; margin: 0 !important; padding: 0 !important;
            min-height: 0 !important; height: auto !important;
          }
          #root { display: none !important; }
          #atlas-print-root {
            display: block !important; min-height: 0 !important; height: auto !important;
          }
          .atlas-page { box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }

        /* Print modal: fixed height, two scrollable columns */
        .atlas-print-modal {
          max-width: 1100px !important;
          width: 96% !important;
          max-height: 92vh !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .atlas-print-modal .modal-body {
          flex: 1;
          overflow: hidden;
          display: grid;
          grid-template-columns: 290px 1fr;
          gap: 20px;
          padding: 20px;
          min-height: 0;
        }
        .atlas-print-settings {
          overflow-y: auto;
          padding-right: 6px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .atlas-print-preview-col {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
        }
        .atlas-preview-pages-wrap {
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        /* Sur téléphone les deux colonnes (290px + aperçu) ne tiennent pas :
           les réglages passent au-dessus de l'aperçu, le tout défilant d'un bloc.
           Ces règles ne touchent que #root, masqué à l'impression. */
        @media (max-width: 768px) {
          .atlas-print-modal {
            width: 100% !important;
            max-width: 100% !important;
          }
          .atlas-print-modal .modal-body {
            grid-template-columns: 1fr;
            overflow-y: auto;
            padding: 16px;
            gap: 16px;
          }
          .atlas-print-settings,
          .atlas-print-preview-col {
            overflow: visible;
            padding-right: 0;
          }
          .atlas-preview-pages-wrap {
            padding: 12px;
            overflow-x: auto;
          }
        }
      `}</style>

      <div className="table-container">
        <div className="table-header">
          <h2>Étiquettes QR ({filtered.length})</h2>
          <div className="table-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SmartSearch
              filters={catFilters}
              onFilterChange={(t, f) => { setSearchText(t); setActiveFilters(f); }}
              placeholder="Rechercher par nom, code, catégorie..."
            />
            <button
              className="btn btn-primary"
              disabled={selected.size === 0}
              style={selected.size === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              onClick={() => openPrint([...selected.values()])}
            >
              <Printer size={16} /> Imprimer la sélection ({selected.size})
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="tab-row" style={{ padding: '0 20px 12px' }}>
          {[
            { key: 'models', label: 'Catalogue', icon: BookOpen, n: models.length },
            { key: 'materials', label: 'Matières Premières', icon: Box, n: materials.length },
          ].map(t => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                      className={on ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={15} /> {t.label} ({t.n})
              </button>
            );
          })}
        </div>

        {/* selection tray — always visible so nothing is selected "invisibly" */}
        {selected.size > 0 && (
          <div style={{
            margin: '0 20px 16px', padding: '12px 14px', borderRadius: 8,
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {selected.size} étiquette{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
              </strong>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setSelected(new Map())}>
                <Trash2 size={13} /> Tout effacer
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
              {selectedList.map(([k, it]) => (
                <span key={k} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                  borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  fontSize: 12, color: 'var(--text-secondary)', maxWidth: 300,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}
                  </span>
                  <button className="btn-icon" style={{ padding: 0, width: 16, height: 16 }}
                          onClick={() => removeKey(k)} title="Retirer">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <button className="btn-icon" onClick={toggleAll} title={allShownSelected ? 'Tout désélectionner' : 'Tout sélectionner'}>
                    {allShownSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th>Code QR</th>
                <th>{tab === 'models' ? 'Nom du Modèle' : 'Nom de la Matière'}</th>
                <th>Catégorie</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(r => {
                const on = isSel(r);
                return (
                  // whole row toggles selection — much faster than aiming at the checkbox
                  <tr key={r.id} onClick={() => toggle(r)}
                      style={{ cursor: 'pointer', background: on ? 'rgba(59,130,246,0.10)' : undefined }}>
                    <td>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); toggle(r); }}>
                        {on ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.barcode || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                    <td><span className="badge badge-scheduled">{r.category}</span></td>
                    <td>
                      <button className="btn-icon edit" title="Imprimer UNIQUEMENT ce modèle (ignore la sélection)"
                              onClick={(e) => { e.stopPropagation(); openPrint([{ ...r, _kind: kind }]); }}>
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- print modal ---------- */}
      {printItems && (
        <div className="modal-overlay" onClick={() => setPrintItems(null)}>
          <div className="modal atlas-print-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><QrCode size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
                {/* the étiquette count only adds information when a sheet holds several */}
                Imprimer — {plural(printItems.length, 'modèle')}
                {perPage > 1 ? ` · ${plural(expanded.length, 'étiquette')}` : ''}
                {` · ${plural(pages.length, fmt.pageWord)} ${fmt.short}`}
              </h2>
              <button className="btn-icon" onClick={() => setPrintItems(null)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {/* ---- settings (left column, scrollable) ---- */}
              <div className="atlas-print-settings">
                <div className="form-group">
                  <label>Format d'impression</label>
                  <select className="form-control" value={format}
                          onChange={e => changeFormat(e.target.value)}>
                    {Object.entries(FORMATS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Réglez le même format dans le pilote de l'imprimante, sinon elle déroule des étiquettes vides.
                  </small>
                </div>

                {/* a single-layout format has nothing to choose */}
                {Object.keys(fmt.layouts).length > 1 && (
                  <div className="form-group">
                    <label>Disposition</label>
                    <select className="form-control" value={perPage}
                            onChange={e => setPerPage(Number(e.target.value))}>
                      {Object.entries(fmt.layouts).map(([k, v]) => (
                        <option key={k} value={Number(k)}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Taille du nom : <strong>{fontMm} mm</strong></label>
                  <input type="range" min={cfg.fontMin} max={fontTop} step={cfg.fontStep} value={fontMm}
                         onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div className="form-group">
                  <label>Taille du QR : <strong>{qrMm} mm</strong></label>
                  <input type="range" min={cfg.qrMin} max={qrCeil} step={1} value={qrMm}
                         onChange={e => setQrSize(Number(e.target.value))} style={{ width: '100%' }} />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Max {qrCeil} mm — la place qui reste une fois le nom, la catégorie et le code posés
                  </small>
                </div>

                <div className="form-group atlas-copies">
                  <label>Exemplaires de chaque étiquette</label>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                    <button type="button" className="btn btn-ghost" title="Diminuer"
                            disabled={copies <= 1}
                            onClick={() => setCopies(c => Math.max(1, c - 1))}
                            style={{ padding: '0 14px', ...(copies <= 1 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}>
                      <Minus size={16} />
                    </button>
                    <input type="number" className="form-control" min={1} max={50} value={copies}
                           onChange={e => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                           style={{ textAlign: 'center', fontWeight: 700 }} />
                    <button type="button" className="btn btn-ghost" title="Augmenter"
                            disabled={copies >= 50}
                            onClick={() => setCopies(c => Math.min(50, c + 1))}
                            style={{ padding: '0 14px', ...(copies >= 50 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showReserved} onChange={e => setShowReserved(e.target.checked)} />
                  <span>Marquer <strong>RÉSERVÉ</strong></span>
                </label>

                <div className="form-group">
                  <label>Note (imprimée sur l'étiquette)</label>
                  <textarea className="form-control" rows={2} value={note} maxLength={200}
                            placeholder="Ex: Client Ahmed — livraison 25/07"
                            onChange={e => setNote(e.target.value)} />
                </div>

                {/* the ceiling shrinks the QR silently — below 20 mm scanning gets unreliable */}
                {qrCeil < 20 && (
                  <div style={{
                    background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.35)',
                    borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)',
                  }}>
                    ⚠ Il ne reste que <strong>{qrCeil} mm</strong> pour le QR sur une étiquette {fmt.short} mm,
                    ce qui rend le scan difficile. Retirez la note ou RÉSERVÉ, ou réduisez la taille du nom.
                  </div>
                )}

                {/* Summary box */}
                <div style={{
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  <div><strong>{printItems.length}</strong> modèle{printItems.length > 1 ? 's' : ''} × <strong>{copies}</strong> exemplaire{copies > 1 ? 's' : ''}</div>
                  <div>= <strong>{expanded.length}</strong> étiquette{expanded.length > 1 ? 's' : ''} sur <strong>{pages.length}</strong> {fmt.pageWord}{pages.length > 1 ? 's' : ''} {fmt.short}</div>
                  {expanded.length > printItems.length * copies && (
                    <div style={{ marginTop: 4, fontSize: 11 }}>⚠ {fmt.pageWord} complétée par répétition</div>
                  )}
                </div>

                {/* per-label removal */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Modèles sélectionnés ({printItems.length})</label>
                  <div style={{
                    maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: 6,
                  }}>
                    {printItems.map((it, idx) => (
                      <div key={it.barcode + idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, padding: '4px 4px', fontSize: 12, color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {idx + 1}. {it.name}
                        </span>
                        <button className="btn-icon" style={{ padding: 0, width: 18, height: 18, flexShrink: 0 }}
                                onClick={() => dropFromPrint(it.barcode)} title="Retirer">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ---- preview (right column, scrollable) ---- */}
              <div className="atlas-print-preview-col">
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  Aperçu — {plural(pages.length, fmt.pageWord)} {fmt.short}
                  {pages.length > PREVIEW_MAX && ` (les ${PREVIEW_MAX} premières affichées)`}
                </div>
                <div className="atlas-preview-pages-wrap">
                  {pages.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', padding: 30 }}>Aucune {fmt.pageWord} à afficher</div>
                  )}
                  {pages.slice(0, PREVIEW_MAX).map((pg, i) => (
                    <div key={i} style={{ flexShrink: 0, width: fmt.previewW }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center', width: fmt.previewW }}>
                        {pageWordCap} {i + 1} / {pages.length} — {pg.map(it => it.name).join(' · ')}
                      </div>
                      <div style={{ width: fmt.previewW, height: previewH, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', width: `${fmt.width}mm`, height: `${fmt.height}mm` }}>
                          <PrintPage items={pg} fontSize={fontMm} qrSize={qrMm} format={format}
                                     showReserved={showReserved} note={note} perPage={perPage} isLast />
                        </div>
                      </div>
                    </div>
                  ))}
                  {pages.length > PREVIEW_MAX && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>
                      … et {pages.length - PREVIEW_MAX} autre{pages.length - PREVIEW_MAX > 1 ? 's' : ''} {fmt.pageWord}{pages.length - PREVIEW_MAX > 1 ? 's' : ''} — toutes seront imprimées.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setPrintItems(null)}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Confirmer et imprimer ({plural(pages.length, fmt.pageWord)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rendered outside #root so @media print can show it alone */}
      {printItems && createPortal(
        <>
          {pages.map((pg, i) => (
            <PrintPage key={i} items={pg} fontSize={fontMm} qrSize={qrMm} showReserved={showReserved}
                       note={note} perPage={perPage} format={format} isLast={i === pages.length - 1} />
          ))}
        </>,
        (() => {
          let el = document.getElementById('atlas-print-root');
          if (!el) {
            el = document.createElement('div');
            el.id = 'atlas-print-root';
            document.body.appendChild(el);
          }
          return el;
        })()
      )}
    </div>
  );
}
