import { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';

/**
 * SmartSearch — Odoo-style search bar with contextual filter chips.
 *
 * Props:
 *   filters: [{ key: string, label: string, icon?: ReactNode, options: [{ value: string, label: string, color?: string }] }]
 *   onFilterChange: (searchText: string, activeFilters: { [key]: value }) => void
 *   placeholder?: string
 */
export default function SmartSearch({ filters = [], onFilterChange, placeholder = 'Rechercher...', initialSearchText = '' }) {
  const [searchText, setSearchText] = useState(initialSearchText);
  const [activeFilters, setActiveFilters] = useState({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const wrapperRef = useRef(null);

  // Sync with initialSearchText if it changes externally
  useEffect(() => {
    if (initialSearchText !== undefined) {
      setSearchText(initialSearchText);
    }
  }, [initialSearchText]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
        setExpandedGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Notify parent whenever search text or filters change
  useEffect(() => {
    onFilterChange?.(searchText, activeFilters);
  }, [searchText, activeFilters]);

  const addFilter = (key, value) => {
    const updated = { ...activeFilters, [key]: value };
    setActiveFilters(updated);
    setShowDropdown(false);
    setExpandedGroup(null);
  };

  const removeFilter = (key) => {
    const updated = { ...activeFilters };
    delete updated[key];
    setActiveFilters(updated);
  };

  const clearAll = () => {
    setActiveFilters({});
    setSearchText('');
  };

  const activeCount = Object.keys(activeFilters).length;

  // Filter suggestions based on typed text
  const getMatchingSuggestions = () => {
    if (!searchText.trim()) return [];
    const lower = searchText.toLowerCase();
    const suggestions = [];
    for (const group of filters) {
      if (activeFilters[group.key]) continue; // already active
      for (const opt of group.options) {
        if (opt.label.toLowerCase().includes(lower)) {
          suggestions.push({ groupKey: group.key, groupLabel: group.label, ...opt });
        }
      }
    }
    return suggestions.slice(0, 6);
  };

  const suggestions = getMatchingSuggestions();

  return (
    <div className="smart-search" ref={wrapperRef}>
      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="smart-search-chips">
          {Object.entries(activeFilters).map(([key, value]) => {
            const group = filters.find(f => f.key === key);
            const option = group?.options.find(o => o.value === value);
            return (
              <span key={key} className="filter-chip" style={option?.color ? { borderColor: option.color, background: `${option.color}15` } : {}}>
                <span className="filter-chip-label">{group?.label}:</span>
                <span className="filter-chip-value" style={option?.color ? { color: option.color } : {}}>{option?.label || value}</span>
                <button className="filter-chip-remove" onClick={() => removeFilter(key)}>
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <button className="filter-chip-clear" onClick={clearAll}>
            <X size={12} /> Effacer
          </button>
        </div>
      )}

      {/* Search input row */}
      <div className="smart-search-input-row">
        <Search className="search-icon" size={16} />
        <input
          className="smart-search-input"
          placeholder={activeCount > 0 ? 'Affiner la recherche...' : placeholder}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onFocus={() => setShowDropdown(true)}
        />
        <button
          className={`smart-search-filter-btn ${showDropdown ? 'active' : ''}`}
          onClick={() => { setShowDropdown(!showDropdown); setExpandedGroup(null); }}
          title="Filtres"
        >
          <Filter size={14} />
          {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="smart-search-dropdown">
          {/* Typed text suggestions */}
          {suggestions.length > 0 && (
            <div className="smart-search-section">
              <div className="smart-search-section-title">Suggestions</div>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  className="smart-search-option"
                  onClick={() => addFilter(s.groupKey, s.value)}
                >
                  <span className="smart-search-option-group">{s.groupLabel}:</span>
                  <span className="smart-search-option-label">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Filter groups */}
          <div className="smart-search-section">
            <div className="smart-search-section-title">
              <Filter size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Filtrer par
            </div>
            {filters.filter(g => !activeFilters[g.key]).map(group => (
              <div key={group.key} className="smart-search-group">
                <button
                  className={`smart-search-group-header ${expandedGroup === group.key ? 'expanded' : ''}`}
                  onClick={() => setExpandedGroup(expandedGroup === group.key ? null : group.key)}
                >
                  <span>{group.icon} {group.label}</span>
                  <ChevronDown size={14} className={`chevron ${expandedGroup === group.key ? 'rotated' : ''}`} />
                </button>
                {expandedGroup === group.key && (
                  <div className="smart-search-group-options">
                    {group.options.map(opt => (
                      <button
                        key={opt.value}
                        className="smart-search-option"
                        onClick={() => addFilter(group.key, opt.value)}
                      >
                        {opt.color && <span className="option-dot" style={{ background: opt.color }} />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
