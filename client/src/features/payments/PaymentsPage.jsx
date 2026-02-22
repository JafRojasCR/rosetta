import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const statusColors = {
  pendiente: 'bg-yellow-50 text-yellow-700',
  aprobado: 'bg-green-50 text-green-700',
  rechazado: 'bg-red-50 text-red-700',
};

const statusLabels = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await api.get('/payments/my');
        setPayments(response.data.data);
      } catch (err) {
        setError('Error al cargar los pagos');
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>
          <p className="text-gray-500 text-sm">{payments.length} pagos registrados</p>
        </div>
        <Link
          to="/pagos/nuevo"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Nuevo pago
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">💳</p>
          <p>No tienes pagos registrados</p>
          <Link to="/pagos/nuevo" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
            Registrar primer pago
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comprobante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clase
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {payments.map((payment) => (
                <tr key={payment.paymentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{payment.billNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{payment.classCode}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(payment.date).toLocaleDateString('es-CR')}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[payment.status]}`}
                    >
                      {statusLabels[payment.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
