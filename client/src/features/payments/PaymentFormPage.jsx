import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

const PaymentFormPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ classCode: '', billNumber: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => setFile(e.target.files[0] || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('classCode', form.classCode);
      formData.append('billNumber', form.billNumber);
      if (file) formData.append('bill', file);

      await api.post('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate('/pagos');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/pagos" className="text-primary-600 text-sm hover:underline mb-4 inline-block">
        ← Volver a pagos
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Registrar Pago</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de clase
            </label>
            <input
              type="text"
              name="classCode"
              value={form.classCode}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ej. MAT-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de comprobante
            </label>
            <input
              type="text"
              name="billNumber"
              value={form.billNumber}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ej. SINPE-123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante de pago (imagen o PDF)
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
            <p className="text-xs text-gray-400 mt-1">Máximo 5MB. Formatos: JPG, PNG, PDF</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Registrando...' : 'Registrar pago'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PaymentFormPage;
