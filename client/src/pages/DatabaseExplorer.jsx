import { useState, useEffect } from 'react';
import api from '../api';
import { Database, Table, Search, RefreshCw, ChevronDown } from 'lucide-react';

export default function DatabaseExplorer() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get('/database/tables');
      setTables(res.data);
      if (res.data.length > 0) {
        handleTableSelect(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    setLoading(true);
    try {
      const res = await api.get(`/database/query/${table}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = search 
    ? data.filter(row => 
        Object.values(row).some(val => 
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header" style={{flexDirection: 'column', alignItems: 'flex-start', gap: 16}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div className="stat-icon purple" style={{padding: 8}}><Database size={24} /></div>
              <h2>Explorateur de Base de Données</h2>
            </div>
            <button className="btn btn-ghost" onClick={() => handleTableSelect(selectedTable)}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>

          <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, width: '100%'}}>
            <div className="form-group" style={{minWidth: 200, marginBottom: 0}}>
              <label style={{fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Choisir une table</label>
              <div style={{position: 'relative'}}>
                <select 
                  className="form-control" 
                  value={selectedTable} 
                  onChange={(e) => handleTableSelect(e.target.value)}
                  style={{paddingRight: 32}}
                >
                  {tables.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown size={16} style={{position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)'}} />
              </div>
            </div>
            
            <div className="search-wrapper" style={{flex: 1, minWidth: 300}}>
              <Search className="search-icon" />
              <input 
                className="search-input" 
                placeholder={`Rechercher dans ${selectedTable}...`} 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div style={{overflowX: 'auto', maxHeight: 'calc(100vh - 300px)'}}>
          {loading ? (
            <div style={{padding: 40, textAlign: 'center', color: 'var(--text-muted)'}}>
              <RefreshCw size={48} className="animate-spin" style={{opacity: 0.3, marginBottom: 16}} />
              <p>Chargement des données...</p>
            </div>
          ) : filteredData.length > 0 ? (
            <table>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => {
                      const val = row[col];
                      return (
                        <td key={col} style={{
                          maxWidth: 250, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          fontSize: 13
                        }}>
                          {val === null ? <em style={{opacity: 0.3}}>null</em> : 
                           typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="table-empty">
              <Table size={48} />
              <p>Aucune donnée trouvée dans la table "{selectedTable}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
