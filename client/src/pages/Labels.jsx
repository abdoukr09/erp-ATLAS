import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import SmartSearch from '../components/SmartSearch';
import { Printer, QrCode, BookOpen, Box, X, CheckSquare, Square, Trash2, Minus, Plus } from 'lucide-react';

/**
 * Étiquettes QR — prints the A4 sheet the factory already glues onto each product,
 * enriched with a QR code, an optional RÉSERVÉ stamp and a free note.
 *
 * The QR encodes ONLY the `barcode` string (ATL-M-xxxxxx / ATL-P-xxxxxx). Names
 * change over time, the code never does — that is what the scanner will read.
 */

// A4 = 210 × 297 mm. qrMax keeps the QR from overflowing its cell.
const LAYOUTS = {
  1: { rows: 1, label: '1 par page', qrMax: 95, qrDefault: 55, small: 4.5, stamp: 8, pad: '8mm' },
  2: { rows: 2, label: '2 par page', qrMax: 60, qrDefault: 40, small: 3.5, stamp: 6, pad: '6mm' },
};
const PAGE_MARGIN_MM = 10;
const MM = 3.7795275591; // px per mm at 96dpi
// Cap only the on-screen preview: rendering hundreds of A4 pages with QR codes
// would freeze the browser. Printing is never capped.
const PREVIEW_MAX = 20;

// One printed label. Always black on white so the dark theme can't ruin a printout.
export function LabelCard({ item, fontSize, qrSize, showReserved, note, perPage }) {
  const cfg = LAYOUTS[perPage];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', height: '100%', width: '100%', boxSizing: 'border-box',
      padding: cfg.pad, background: '#fff', color: '#000',
      border: '1px dashed #bbb', overflow: 'hidden', gap: perPage === 2 ? '3mm' : '4mm',
    }}>
      {showReserved && (
        <div style={{
          border: '3px solid #000', padding: '2mm 8mm', fontWeight: 900, letterSpacing: '2px',
          fontSize: `${cfg.stamp}mm`, transform: 'rotate(-3deg)', lineHeight: 1.1, flexShrink: 0,
        }}>
          RÉSERVÉ
        </div>
      )}

      <div style={{ fontSize: `${fontSize}mm`, fontWeight: 800, lineHeight: 1.15, wordBreak: 'break-word', width: '100%' }}>
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
        <div style={{ fontSize: `${cfg.small}mm`, borderTop: '1px solid #000', paddingTop: '2mm', width: '90%', wordBreak: 'break-word' }}>
          {note}
        </div>
      )}
    </div>
  );
}

// A4 sheet holding up to `perPage` labels.
export function PrintPage({ items, fontSize, qrSize, showReserved, note, perPage, isLast }) {
  const cfg = LAYOUTS[perPage];
  return (
    <div
      className="atlas-page"
      style={{
        width: '210mm', height: '297mm', boxSizing: 'border-box', padding: `${PAGE_MARGIN_MM}mm`,
        background: '#fff', display: 'grid', gridTemplateRows: `repeat(${cfg.rows}, 1fr)`,
        pageBreakAfter: isLast ? 'auto' : 'always', breakAfter: isLast ? 'auto' : 'page',
      }}
    >
      {/* index-keyed: the same label can legitimately repeat on a page */}
      {items.map((it, i) => (
        <LabelCard key={i} item={it} fontSize={fontSize} qrSize={qrSize}
                   showReserved={showReserved} note={note} perPage={perPage} />
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
  const [fontSize, setFontSize] = useState(16);   // mm
  const [qrSize, setQrSize] = useState(55);       // mm
  const [perPage, setPerPage] = useState(1);
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

  // keep the QR inside its cell when the layout changes
  useEffect(() => {
    const layout = LAYOUTS[Number(perPage)];
    if (layout) setQrSize(q => Math.min(q, layout.qrMax));
  }, [perPage]);

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
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          #root { display: none !important; }
          #atlas-print-root { display: block !important; }
          .atlas-page { box-shadow: none !important; }
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
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px' }}>
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
                Imprimer — {printItems.length} modèle{printItems.length > 1 ? 's' : ''}, {expanded.length} étiquette{expanded.length > 1 ? 's' : ''}, {pages.length} page{pages.length > 1 ? 's' : ''} A4
              </h2>
              <button className="btn-icon" onClick={() => setPrintItems(null)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {/* ---- settings (left column, scrollable) ---- */}
              <div className="atlas-print-settings">
                <div className="form-group">
                  <label>Taille du nom : <strong>{fontSize} mm</strong></label>
                  <input type="range" min={6} max={30} step={1} value={fontSize}
                         onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div className="form-group">
                  <label>Taille du QR : <strong>{qrSize} mm</strong></label>
                  <input type="range" min={15} max={LAYOUTS[perPage]?.qrMax ?? 55} step={1} value={qrSize}
                         onChange={e => setQrSize(Number(e.target.value))} style={{ width: '100%' }} />
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Max {LAYOUTS[perPage]?.qrMax ?? 55} mm · 30 mm ou plus recommandé pour le scan
                  </small>
                </div>

                <div className="form-group">
                  <label>Disposition</label>
                  <select className="form-control" value={perPage}
                          onChange={e => setPerPage(Number(e.target.value))}>
                    {Object.entries(LAYOUTS).map(([k, v]) => (
                      <option key={k} value={Number(k)}>{v.label}</option>
                    ))}
                  </select>
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

                {/* Summary box */}
                <div style={{
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  <div><strong>{printItems.length}</strong> modèle{printItems.length > 1 ? 's' : ''} × <strong>{copies}</strong> exemplaire{copies > 1 ? 's' : ''}</div>
                  <div>= <strong>{expanded.length}</strong> étiquette{expanded.length > 1 ? 's' : ''} sur <strong>{pages.length}</strong> page{pages.length > 1 ? 's' : ''} A4</div>
                  {expanded.length > printItems.length * copies && (
                    <div style={{ marginTop: 4, fontSize: 11 }}>⚠ page complétée par répétition</div>
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
                  Aperçu — {pages.length} page{pages.length > 1 ? 's' : ''} A4
                  {pages.length > PREVIEW_MAX && ` (les ${PREVIEW_MAX} premières affichées)`}
                </div>
                <div className="atlas-preview-pages-wrap">
                  {pages.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', padding: 30 }}>Aucune page à afficher</div>
                  )}
                  {pages.slice(0, PREVIEW_MAX).map((pg, i) => (
                    <div key={i} style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>
                        Page {i + 1} / {pages.length} — {pg.map(it => it.name).join(' · ')}
                      </div>
                      <div style={{ width: 'calc(210mm * 0.47)', height: 'calc(297mm * 0.47)', position: 'relative' }}>
                        <div style={{ transform: 'scale(0.47)', transformOrigin: 'top left', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                          <PrintPage items={pg} fontSize={fontSize} qrSize={qrSize}
                                     showReserved={showReserved} note={note} perPage={perPage} isLast />
                        </div>
                      </div>
                    </div>
                  ))}
                  {pages.length > PREVIEW_MAX && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>
                      … et {pages.length - PREVIEW_MAX} autre{pages.length - PREVIEW_MAX > 1 ? 's' : ''} page{pages.length - PREVIEW_MAX > 1 ? 's' : ''} — toutes seront imprimées.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setPrintItems(null)}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Confirmer et imprimer ({pages.length} page{pages.length > 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rendered outside #root so @media print can show it alone */}
      {printItems && createPortal(
        <>
          {pages.map((pg, i) => (
            <PrintPage key={i} items={pg} fontSize={fontSize} qrSize={qrSize} showReserved={showReserved}
                       note={note} perPage={perPage} isLast={i === pages.length - 1} />
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
