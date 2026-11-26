import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';

const SubtypeSelectDropdown = ({
  value,
  onChange,
  subtypes = [],
  onCreateSubtype,
  onDeleteSubtype,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newSubtypeName, setNewSubtypeName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowAddInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async () => {
    const trimmed = newSubtypeName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const createdName = await onCreateSubtype(trimmed);
      if (createdName) {
        onChange(createdName);
        setNewSubtypeName('');
        setShowAddInput(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onDeleteSubtype(id, name);
      if (value === name) {
        onChange('');
      }
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex-1 bg-gray-50 border-2 rounded-2xl px-4 py-3 text-sm font-medium text-left flex items-center justify-between gap-2 transition-all outline-none ${
            isOpen
              ? 'border-blue-500 bg-white'
              : 'border-transparent hover:border-gray-200'
          }`}
        >
          <span className={value ? 'text-gray-900 font-semibold truncate' : 'text-gray-400'}>
            {value || 'Seleccionar subtipo / tema...'}
          </span>
          <ChevronDown
            size={18}
            className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : 'rotate-0'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setShowAddInput((prev) => !prev);
          }}
          title="Agregar nuevo subtipo"
          className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Dropdown menu */}
      <div
        className={`absolute left-0 right-0 mt-2 z-30 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden origin-top transition-all duration-200 ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        }`}
      >
        {showAddInput && (
          <div className="p-3 bg-blue-50/70 border-b border-blue-100 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newSubtypeName}
              onChange={(e) => setNewSubtypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                } else if (e.key === 'Escape') {
                  setShowAddInput(false);
                }
              }}
              placeholder="Nombre del nuevo subtipo..."
              className="flex-1 bg-white border border-blue-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newSubtypeName.trim()}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              title="Guardar subtipo"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false);
                setNewSubtypeName('');
              }}
              className="p-2 rounded-xl bg-white text-gray-500 hover:text-gray-700 border border-gray-200 transition-colors"
              title="Cancelar"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            >
              Sin subtipo
            </button>
          )}

          {loading ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center font-medium">
              Cargando subtipos...
            </p>
          ) : subtypes.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center font-medium">
              No hay subtipos registrados. Usa el botón + para crear uno.
            </p>
          ) : (
            subtypes.map((sub) => {
              const selected = value === sub.name;
              return (
                <div
                  key={sub._id}
                  onClick={() => {
                    onChange(sub.name);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    selected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <span className="text-xs sm:text-sm truncate flex-1">{sub.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, sub._id, sub.name)}
                    disabled={deletingId === sub._id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Eliminar subtipo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SubtypeSelectDropdown;
