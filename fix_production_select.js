const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/Production.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the select block targeting orders and swap it for items lookups using pure regex
const selectRegex = /<select[^>]*value=\{form\.orderId\}[^>]*>[\s\S]*?<\/select>/;

const replacement = `<select className="form-control" value={form.orderItemId} onChange={e => setForm({...form, orderItemId: e.target.value})} required disabled={editing}>
                        <option value="">Sélectionner un article</option>
                        {orders.flatMap(o => (o.items || []).filter(item => item.status === 'pending' || (editing && item.id == form.orderItemId)).map(item => (
                          <option key={item.id} value={item.id}>Cde #\${o.id} - \${item.sofaModel} (\${o.customer?.name})</option>
                        )))}
                      </select>`;

if (selectRegex.test(content)) {
   content = content.replace(selectRegex, replacement);
   content = content.replace('<label>Commande *</label>', '<label>Commande / Article *</label>');
   fs.writeFileSync(filePath, content);
   console.log("✅ Production.jsx SELECT block replaced programmatically!");
} else {
   console.log("❌ Regex didn't hit. Select structure differs in spaces or quotes.");
   // print the problematic block for debugging
   const match = content.match(/<select[\s\S]*?value=\{form\.orderId\}[\s\S]*?<\/select>/);
   if (match) console.log("Partial Match Found:", match[0]);
}
