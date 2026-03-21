const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/FinishedProducts.jsx');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('<th>Modèle</th>')) {
  // Update Header
  content = content.replace('<th>Unités en Stock</th>', '<th>Unités en Stock</th>\n              <th>Capable de Produire</th>');
  
  // Regex for the table row
  const rowRegex = /<td[^>]*>\{m\.name\}<\/td>\s*<td>\{m\.category\s*\|\|\s*'—'\}<\/td>\s*<td><span[^>]*>\{m\.stock\s*\|\|\s*0\}<\/span>\s*units<\/td>\s*<td>\{m\.basePrice\}\s*DA<\/td>/;

  const replacement = `<td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.category || '—'}</td>
                <td><span className={\`badge \${m.stock > 0 ? 'badge-delivered' : 'badge-pending'}\`} style={{ fontSize: '1.05rem' }}>{m.stock || 0}</span></td>
                <td>
                  {m.maxProducible > 0 ? (
                    <span className="badge badge-delivered" style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontSize: '0.92em'}}>
                      ✓ Oui ({m.maxProducible})
                    </span>
                  ) : m.maxProducible === 0 ? (
                    <span className="badge badge-cancelled" style={{background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.92em'}}>
                      ✗ Matières Insuffisantes
                    </span>
                  ) : (
                    <span className="badge badge-pending" style={{fontSize: '0.92em'}}>Non Configuré</span>
                  )}
                </td>
                <td>{m.basePrice} DA</td>`;
                
  if (rowRegex.test(content)) {
     content = content.replace(rowRegex, replacement);
     content = content.replace('colSpan="4"', 'colSpan="5"');
     fs.writeFileSync(filePath, content);
     console.log("✅ FinishedProducts.jsx updated successfully with regex!");
  } else {
     console.log("❌ Regex didn't hit. Select row template differs slightly.");
     const match = content.match(/<td[^>]*>\{m\.name\}<\/td>[\s\S]*?<\/tr>/);
     if (match) console.log("Partial Match Row Found:", match[0]);
  }
} else {
  console.log("❌ Header string not found.");
}
