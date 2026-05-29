import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Calendar,
  CreditCard,
  Percent,
  ChevronLeft,
  ChevronRight,
  Award,
  CalendarDays,
  Clock,
  User,
  BookOpen,
  Filter,
  BarChart3,
  Book,
  Activity,
  UserCheck,
  TrendingDown,
  X,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatCurrency = (val) => {
  if (val === undefined || val === null || Number.isNaN(val)) return '0';
  return `${Number(val).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDateTime = (value) => {
  if (!value) return '--/--/---- --:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/---- --:--';
  return date.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const AdminStatsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  // Date Filters
  const [presetRange, setPresetRange] = useState('all'); // 30days, 90days, year, all
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Trends Chart Filter
  const [granularity, setGranularity] = useState('daily'); // daily, weekly, monthly
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);

  // Performance Calendar Date
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedDayDetails, setSelectedDayDetails] = useState(null); // { date: Date, payments: [] }

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentsResponse, classesResponse, studentsResponse] = await Promise.all([
          api.get('/payments/all'),
          api.get('/classes'),
          api.get('/admin/students'),
        ]);

        setPayments(paymentsResponse.data?.data || []);
        setClasses(classesResponse.data?.data || []);
        setStudents(studentsResponse.data?.data || []);
      } catch (_requestError) {
        setError('No se pudieron cargar los datos para las estadísticas.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helpers mappings
  const classesByCode = useMemo(() => {
    return (classes || []).reduce((acc, cls) => {
      acc[String(cls.classCode || '').trim()] = cls;
      return acc;
    }, {});
  }, [classes]);

  const studentsByEmail = useMemo(() => {
    return (students || []).reduce((acc, s) => {
      const email = String(s?.email || '').toLowerCase().trim();
      if (!email) return acc;
      acc[email] = `${String(s?.name || '').trim()} ${String(s?.lastName || '').trim()}`.trim();
      return acc;
    }, {});
  }, [students]);

  const getStudentName = (email = '') => {
    const normalized = String(email || '').toLowerCase().trim();
    return studentsByEmail[normalized] || email || 'Estudiante';
  };

  // Pre-processed Approved Payments
  const approvedPayments = useMemo(() => {
    return (payments || [])
      .filter((p) => p.status === 'aprobado')
      .map((p) => {
        const cls = classesByCode[String(p.classCode || '').trim()];
        const amountVal = cls ? (cls.price ?? 0) : (p.amount ?? 0);
        return {
          ...p,
          resolvedAmount: amountVal,
          subjectName: cls?.subject?.name || 'Sin materia',
          classTitle: cls?.title || 'Clase',
          paymentDateObj: new Date(p.date || p.createdAt),
        };
      })
      .sort((a, b) => b.paymentDateObj - a.paymentDateObj);
  }, [payments, classesByCode]);

  // Handle Preset Ranges
  useEffect(() => {
    if (presetRange === 'all') {
      setStartDateStr('');
      setEndDateStr('');
      return;
    }

    const end = new Date();
    let start = new Date();

    if (presetRange === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (presetRange === '90days') {
      start.setDate(end.getDate() - 90);
    } else if (presetRange === 'year') {
      start.setFullYear(end.getFullYear() - 1);
    }

    setStartDateStr(start.toISOString().slice(0, 10));
    setEndDateStr(end.toISOString().slice(0, 10));
  }, [presetRange]);

  // Filtered Payments based on Dates
  const filteredPayments = useMemo(() => {
    return approvedPayments.filter((p) => {
      if (startDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        if (p.paymentDateObj < start) return false;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        if (p.paymentDateObj > end) return false;
      }
      return true;
    });
  }, [approvedPayments, startDateStr, endDateStr]);

  // METRIC TOTALS
  const totalRevenue = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.resolvedAmount, 0);
  }, [filteredPayments]);

  const averageTicket = useMemo(() => {
    if (filteredPayments.length === 0) return 0;
    return totalRevenue / filteredPayments.length;
  }, [filteredPayments, totalRevenue]);

  const uniqueClassesPaidCount = useMemo(() => {
    const codes = new Set(filteredPayments.map((p) => p.classCode));
    return codes.size;
  }, [filteredPayments]);

  const totalTransactionsCount = filteredPayments.length;

  // ACADEMIC SUBJECT CONSOLIDATION
  const subjectBreakdown = useMemo(() => {
    const counts = {};
    filteredPayments.forEach((p) => {
      const subject = p.subjectName;
      if (!counts[subject]) {
        counts[subject] = { amount: 0, count: 0 };
      }
      counts[subject].amount += p.resolvedAmount;
      counts[subject].count += 1;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: totalRevenue > 0 ? (data.amount / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredPayments, totalRevenue]);

  // WEEKDAY VS WEEKEND COMPARISON
  const weekdayWeekendComparison = useMemo(() => {
    let weekdayAmount = 0;
    let weekendAmount = 0;
    let weekdayCount = 0;
    let weekendCount = 0;

    filteredPayments.forEach((p) => {
      const day = p.paymentDateObj.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = day === 0 || day === 6;
      if (isWeekend) {
        weekendAmount += p.resolvedAmount;
        weekendCount += 1;
      } else {
        weekdayAmount += p.resolvedAmount;
        weekdayCount += 1;
      }
    });

    const total = weekdayAmount + weekendAmount;
    return {
      weekdayAmount,
      weekendAmount,
      weekdayCount,
      weekendCount,
      weekdayPercentage: total > 0 ? (weekdayAmount / total) * 100 : 0,
      weekendPercentage: total > 0 ? (weekendAmount / total) * 100 : 0,
    };
  }, [filteredPayments]);

  // RENTABILITY RANKING OF CLASSES
  const classProfitabilityRanking = useMemo(() => {
    const classRevenue = {};
    filteredPayments.forEach((p) => {
      const code = p.classCode;
      if (!classRevenue[code]) {
        classRevenue[code] = {
          classCode: code,
          title: p.classTitle,
          subject: p.subjectName,
          amount: 0,
          paymentsCount: 0,
        };
      }
      classRevenue[code].amount += p.resolvedAmount;
      classRevenue[code].paymentsCount += 1;
    });

    const maxClassVal = Object.values(classRevenue).reduce((max, c) => Math.max(max, c.amount), 0);

    return Object.values(classRevenue)
      .map((c) => ({
        ...c,
        relativeShare: maxClassVal > 0 ? (c.amount / maxClassVal) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // top 5
  }, [filteredPayments]);

  // TRENDS GROUPING & COORDINATES FOR SVG CHART
  const chartData = useMemo(() => {
    if (filteredPayments.length === 0) return [];

    const grouped = {};

    // Grouping
    filteredPayments.forEach((p) => {
      let key = '';
      if (granularity === 'daily') {
        key = p.paymentDateObj.toISOString().slice(0, 10);
      } else if (granularity === 'weekly') {
        const d = new Date(p.paymentDateObj);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        const startOfWeek = new Date(d.setDate(diff));
        key = `${startOfWeek.getDate().toString().padStart(2, '0')}/${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}`;
      } else {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        key = `${months[p.paymentDateObj.getMonth()]} ${p.paymentDateObj.getFullYear().toString().slice(2)}`;
      }

      if (!grouped[key]) grouped[key] = { label: key, amount: 0, count: 0 };
      grouped[key].amount += p.resolvedAmount;
      grouped[key].count += 1;
    });

    // Sort items chronologically
    let sortedKeys = Object.keys(grouped);
    if (granularity === 'daily') {
      sortedKeys.sort((a, b) => new Date(a) - new Date(b));
    } else if (granularity === 'monthly') {
      const parseMonth = (key) => {
        const [mName, yy] = key.split(' ');
        const mIdx = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].indexOf(mName);
        return new Date(2000 + parseInt(yy, 10), mIdx, 1);
      };
      sortedKeys.sort((a, b) => parseMonth(a) - parseMonth(b));
    }
    // We keep weekly key order as is or simple sort
    
    // Fill daily gaps if they are within bounds to make a beautiful area line
    if (granularity === 'daily' && sortedKeys.length > 1) {
      const minDate = new Date(sortedKeys[0]);
      const maxDate = new Date(sortedKeys[sortedKeys.length - 1]);
      const filled = [];
      
      for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        if (grouped[dateStr]) {
          filled.push(grouped[dateStr]);
        } else {
          const daysNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          const label = `${daysNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
          filled.push({ label: label, amount: 0, count: 0, rawDate: dateStr });
        }
      }
      
      // Map label for better daily reading
      return filled.map((item) => {
        if (item.rawDate) {
          const d = new Date(item.rawDate);
          return {
            ...item,
            label: `${d.getDate()}/${d.getMonth() + 1}`,
          };
        }
        const parts = item.label.split('-');
        if (parts.length === 3) {
          return {
            ...item,
            label: `${parts[2]}/${parts[1]}`,
          };
        }
        return item;
      });
    }

    return sortedKeys.map((k) => grouped[k]);
  }, [filteredPayments, granularity]);

  const svgParams = useMemo(() => {
    if (chartData.length === 0) return null;

    const maxVal = chartData.reduce((max, d) => Math.max(max, d.amount), 0) || 1000;
    const paddingX = 40;
    const paddingY = 30;
    const width = 600;
    const height = 240;

    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    const points = chartData.map((d, index) => {
      const x = paddingX + (index / (chartData.length - 1 || 1)) * chartWidth;
      const y = paddingY + chartHeight - (d.amount / maxVal) * chartHeight;
      return { x, y, data: d };
    });

    // Make smooth curve path
    let linePath = '';
    let areaPath = '';
    
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`;
      areaPath = `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y}`;

      for (let index = 1; index < points.length; index += 1) {
        const current = points[index];
        const prev = points[index - 1];
        // Bezier control points for smooth line
        const cpX1 = prev.x + (current.x - prev.x) / 3;
        const cpY1 = prev.y;
        const cpX2 = prev.x + 2 * (current.x - prev.x) / 3;
        const cpY2 = current.y;
        
        linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${current.x} ${current.y}`;
        areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${current.x} ${current.y}`;
      }

      areaPath += ` L ${points[points.length - 1].x} ${height - paddingY} Z`;
    }

    return {
      width,
      height,
      paddingX,
      paddingY,
      chartWidth,
      chartHeight,
      maxVal,
      points,
      linePath,
      areaPath,
    };
  }, [chartData]);

  // PERFORMANCE CALENDAR CALCULATIONS
  const calendarDays = useMemo(() => {
    // First day of the month
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    // Number of days in the month
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    // Weekday index of first day: 0 = Sun, 1 = Mon ... 6 = Sat
    let startDayIdx = firstDay.getDay(); 
    // Shift index so Monday is 0
    startDayIdx = startDayIdx === 0 ? 6 : startDayIdx - 1;

    // Previous month total days to fill initial cells
    const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();

    const days = [];

    // Fill previous month cells
    for (let index = startDayIdx - 1; index >= 0; index -= 1) {
      const dayNum = prevMonthTotalDays - index;
      const date = new Date(calendarYear, calendarMonth - 1, dayNum);
      days.push({ dayNum, date, isCurrentMonth: false });
    }

    // Fill current month cells
    for (let dayNum = 1; dayNum <= totalDays; dayNum += 1) {
      const date = new Date(calendarYear, calendarMonth, dayNum);
      days.push({ dayNum, date, isCurrentMonth: true });
    }

    // Fill next month cells to complete grid rows (usually 42 cells or 35)
    const remainingCells = 42 - days.length;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum += 1) {
      const date = new Date(calendarYear, calendarMonth + 1, dayNum);
      days.push({ dayNum, date, isCurrentMonth: false });
    }

    // Attach payments and revenue to each cell
    return days.map((cell) => {
      const cellDateStr = cell.date.toISOString().slice(0, 10);
      const cellPayments = approvedPayments.filter((p) => {
        const pDateStr = p.paymentDateObj.toISOString().slice(0, 10);
        return pDateStr === cellDateStr;
      });
      const revenue = cellPayments.reduce((sum, p) => sum + p.resolvedAmount, 0);

      return {
        ...cell,
        payments: cellPayments,
        revenue,
      };
    });
  }, [calendarYear, calendarMonth, approvedPayments]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
    setSelectedDayDetails(null);
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
    setSelectedDayDetails(null);
  };

  const handleDayClick = (cell) => {
    if (cell.revenue === 0) {
      setSelectedDayDetails(null);
      return;
    }
    setSelectedDayDetails({
      date: cell.date,
      payments: cell.payments,
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col overflow-x-hidden transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      {/* Header Navigation */}
      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 shrink-0"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-800 tracking-tight truncate">
              Estadísticas del sistema
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Métricas de rentabilidad y recaudación general</p>
          </div>
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shrink-0">
          <Activity size={20} className="sm:w-6 sm:h-6" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-bold">
            {error}
          </div>
        )}

        {/* Global Date Presets & Date Picker Controls */}
        <section className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-gray-400 mr-1 hidden sm:inline" />
            {[
              { id: 'all', label: 'Todo el historial' },
              { id: '30days', label: 'Últimos 30 días' },
              { id: '90days', label: 'Últimos 90 días' },
              { id: 'year', label: 'Último año' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setPresetRange(preset.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  presetRange === preset.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Desde</span>
              <input
                type="date"
                value={startDateStr}
                onChange={(event) => {
                  setStartDateStr(event.target.value);
                  setPresetRange('');
                }}
                className="bg-transparent text-xs font-bold text-gray-800 outline-none w-28"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Hasta</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(event) => {
                  setEndDateStr(event.target.value);
                  setPresetRange('');
                }}
                className="bg-transparent text-xs font-bold text-gray-800 outline-none w-28"
              />
            </div>
          </div>
        </section>

        {/* METRICS CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex items-start gap-3 sm:gap-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2.5 h-full bg-emerald-500" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <DollarSign size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Recaudado</p>
              <h4 className="text-sm sm:text-xl font-extrabold text-gray-900 mt-1 truncate">
                {formatCurrency(totalRevenue)}
              </h4>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Ingresos reales netos</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex items-start gap-3 sm:gap-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2.5 h-full bg-indigo-500" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Activity size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Monto Promedio</p>
              <h4 className="text-sm sm:text-xl font-extrabold text-gray-900 mt-1 truncate">
                {formatCurrency(averageTicket)}
              </h4>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Por transacción aprobada</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex items-start gap-3 sm:gap-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2.5 h-full bg-amber-500" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <BookOpen size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Clases Pagadas</p>
              <h4 className="text-sm sm:text-xl font-extrabold text-gray-900 mt-1 truncate">
                {uniqueClassesPaidCount} Clases
              </h4>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Mínimo un pago aprobado</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm flex items-start gap-3 sm:gap-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2.5 h-full bg-violet-500" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <CreditCard size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Transacciones</p>
              <h4 className="text-sm sm:text-xl font-extrabold text-gray-900 mt-1 truncate">
                {totalTransactionsCount} Aprobadas
              </h4>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Comprobantes validados</p>
            </div>
          </div>
        </section>

        {/* ACADEMIC SUBJECT & GRAPHS */}
        <section className="grid lg:grid-cols-12 gap-6">
          
          {/* Trends Dynamic SVG Chart */}
          <div className="lg:col-span-8 bg-white rounded-[2rem] border border-gray-100 p-4 sm:p-6 shadow-sm flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Tendencia de ingresos</h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Representación de fondos percibidos en el tiempo</p>
              </div>

              {/* Granularity Toggle */}
              <div className="flex items-center bg-gray-50 border border-gray-100 p-1 rounded-xl shrink-0">
                {[
                  { id: 'daily', label: 'Día' },
                  { id: 'monthly', label: 'Mes' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setGranularity(g.id);
                      setHoveredDataPoint(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                      granularity === g.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                    type="button"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Chart Drawing */}
            <div className="flex-1 min-h-[220px] relative flex flex-col justify-center">
              {chartData.length === 0 ? (
                <div className="h-44 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                  <BarChart3 size={28} className="mb-2 text-gray-300" />
                  <p className="text-xs font-bold">No hay transacciones aprobadas en el rango.</p>
                </div>
              ) : svgParams ? (
                <div className="w-full relative select-none">
                  <svg
                    viewBox={`0 0 ${svgParams.width} ${svgParams.height}`}
                    className="w-full h-auto overflow-visible"
                  >
                    <defs>
                      <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = svgParams.paddingY + ratio * svgParams.chartHeight;
                      const gridVal = svgParams.maxVal * (1 - ratio);
                      return (
                        <g key={ratio} className="opacity-45">
                          <line
                            x1={svgParams.paddingX}
                            y1={y}
                            x2={svgParams.width - svgParams.paddingX}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={svgParams.paddingX - 6}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="8"
                            fontWeight="800"
                            fill="#94a3b8"
                          >
                            {formatCurrency(gridVal).replace('₡', '').split(',')[0]}
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart Area Fill */}
                    {granularity !== 'monthly' && svgParams.areaPath && (
                      <path d={svgParams.areaPath} fill="url(#chartAreaGradient)" />
                    )}

                    {/* Chart Smooth Line */}
                    {granularity !== 'monthly' && svgParams.linePath && (
                      <path
                        d={svgParams.linePath}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Monthly Bar Drawing */}
                    {granularity === 'monthly' &&
                      svgParams.points.map((p, index) => {
                        const barWidth = Math.min(26, svgParams.chartWidth / (chartData.length * 1.6));
                        const barHeight = svgParams.height - svgParams.paddingY - p.y;
                        const isHovered = hoveredDataPoint === index;
                        return (
                          <rect
                            key={index}
                            x={p.x - barWidth / 2}
                            y={p.y}
                            width={barWidth}
                            height={Math.max(4, barHeight)}
                            rx="5"
                            fill={isHovered ? '#4338ca' : '#4f46e5'}
                            opacity={hoveredDataPoint !== null && !isHovered ? 0.6 : 1}
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHoveredDataPoint(index)}
                            onMouseLeave={() => setHoveredDataPoint(null)}
                          />
                        );
                      })}

                    {/* Line Interactive Nodes */}
                    {granularity !== 'monthly' &&
                      svgParams.points.map((p, index) => {
                        const isHovered = hoveredDataPoint === index;
                        return (
                          <g key={index} className="cursor-pointer">
                            {/* Larger outer glow ring on hover */}
                            {isHovered && (
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="9"
                                fill="#4f46e5"
                                opacity="0.25"
                              />
                            )}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? '5.5' : '4'}
                              fill={isHovered ? '#4338ca' : '#ffffff'}
                              stroke="#4f46e5"
                              strokeWidth={isHovered ? '2.5' : '2'}
                              onMouseEnter={() => setHoveredDataPoint(index)}
                              onMouseLeave={() => setHoveredDataPoint(null)}
                            />
                          </g>
                        );
                      })}

                    {/* X Axis labels */}
                    {(() => {
                      // Skip some labels if list is extremely long to avoid overlaps
                      const skipFactor = Math.ceil(chartData.length / 10);
                      return svgParams.points.map((p, index) => {
                        if (index % skipFactor !== 0 && index !== chartData.length - 1) return null;
                        return (
                          <text
                            key={index}
                            x={p.x}
                            y={svgParams.height - svgParams.paddingY + 16}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight="800"
                            fill="#64748b"
                          >
                            {p.data.label}
                          </text>
                        );
                      });
                    })()}
                  </svg>

                  {/* Tooltip Overlay */}
                  {hoveredDataPoint !== null && chartData[hoveredDataPoint] && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-[10px] sm:text-xs font-black shadow-xl flex items-center gap-2 z-10 transition-all">
                      <span className="text-gray-400 tracking-wide uppercase">{chartData[hoveredDataPoint].label}:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(chartData[hoveredDataPoint].amount)}</span>
                      <span className="text-slate-500 font-medium">({chartData[hoveredDataPoint].count} pagos)</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Subject Consolidation (Academic ecosystem) */}
          <div className="lg:col-span-4 bg-white rounded-[2rem] border border-gray-100 p-4 sm:p-6 shadow-sm flex flex-col min-w-0">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Por materia académica</h3>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Recaudación y porcentaje de participación</p>
            </div>

            <div className="flex-1 mt-4 sm:mt-6 overflow-y-auto max-h-[240px] pr-1 space-y-4">
              {subjectBreakdown.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-6 text-center text-xs sm:text-sm font-semibold text-gray-500">
                  Sin datos registrados por materia académica.
                </div>
              ) : (
                subjectBreakdown.map((subject) => {
                  return (
                    <div key={subject.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-900">
                        <span className="truncate pr-2">{subject.name}</span>
                        <span className="shrink-0">{formatCurrency(subject.amount)}</span>
                      </div>
                      
                      {/* Progress line */}
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden relative">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${subject.percentage}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[10px] text-gray-500 font-bold">
                        <span>{subject.count} pago(s)</span>
                        <span className="text-indigo-600 font-black">{subject.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* PERFORMANCE CALENDAR & RANKINGS */}
        <section className="grid lg:grid-cols-12 gap-6">
          
          {/* Performance Calendar Grid */}
          <div className="lg:col-span-8 bg-white rounded-[2.25rem] border border-gray-100 p-4 sm:p-7 shadow-sm min-w-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Calendario de rendimiento</h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Ingresos percibidos consolidados por día</p>
              </div>

              {/* Month Navigator */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-xl shrink-0">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors"
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-black text-slate-800 tracking-tight uppercase select-none min-w-[7rem] text-center">
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors"
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Grid UI */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center flex-1">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-[10px] font-black uppercase text-gray-400 tracking-wider pb-2">
                  {d}
                </div>
              ))}

              {calendarDays.map((cell, index) => {
                const hasEarnings = cell.revenue > 0;
                const cellBg =
                  !cell.isCurrentMonth
                    ? 'bg-gray-50/40 text-gray-400/60 opacity-60'
                    : hasEarnings
                      ? 'bg-emerald-50/50 hover:bg-emerald-50 text-gray-800 border-emerald-100 hover:scale-[1.02] cursor-pointer'
                      : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-100';

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(cell)}
                    className={`min-h-[52px] sm:min-h-[64px] border rounded-xl sm:rounded-2xl p-1 flex flex-col justify-between transition-all select-none ${cellBg}`}
                  >
                    <span className="text-[10px] sm:text-xs font-black self-start p-0.5">
                      {cell.dayNum}
                    </span>
                    
                    {hasEarnings && (
                      <span className="bg-emerald-500/10 text-emerald-700 text-[9px] sm:text-[10px] font-extrabold px-1 py-0.5 rounded-lg border border-emerald-500/10 truncate w-full text-center">
                        {formatCurrency(cell.revenue).split(',')[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <p className="text-[10px] font-bold text-gray-400 mt-4 leading-relaxed">
              * Toca cualquier casilla marcada en verde para ver el desglose emergente con las clases específicas que originaron los fondos.
            </p>
          </div>

          {/* Rankings, WEEKDAY VS WEEKEND AND DETAILS POPUP */}
          <div className="lg:col-span-4 space-y-6 flex flex-col min-w-0">
            
            {/* Calendar Day Desglose Popover / Modal side-panel */}
            {selectedDayDetails ? (
              <div className="bg-slate-900 text-white rounded-[2.25rem] p-4 sm:p-6 shadow-xl relative overflow-hidden animate-fade-in flex flex-col">
                <button
                  onClick={() => setSelectedDayDetails(null)}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full text-white/70 transition-colors"
                  type="button"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <CalendarDays size={18} />
                  <h4 className="text-xs font-black uppercase tracking-widest">Desglose de ingresos</h4>
                </div>

                <p className="text-sm font-black mb-1">
                  {selectedDayDetails.date.toLocaleDateString('es-CR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="text-xs font-semibold text-gray-400">
                  Total diario: <span className="text-emerald-400 font-black">{formatCurrency(
                    selectedDayDetails.payments.reduce((sum, p) => sum + p.resolvedAmount, 0)
                  )}</span>
                </p>

                <div className="mt-4 space-y-3 overflow-y-auto max-h-[220px] pr-1 flex-1">
                  {selectedDayDetails.payments.map((p) => (
                    <div key={p.paymentId} className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-black text-white truncate max-w-[70%]">{p.classTitle}</span>
                        <span className="text-xs font-extrabold text-emerald-400 shrink-0">{formatCurrency(p.resolvedAmount)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">Código: {p.classCode}</p>
                      
                      <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-semibold pt-1">
                        <User size={10} className="shrink-0" />
                        <span className="truncate">{getStudentName(p.studentEmail)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[9px] text-gray-400/70 font-semibold">
                        <span className="truncate">{p.subjectName}</span>
                        <span className="flex items-center gap-0.5"><Clock size={9} /> {formatDateTime(p.date || p.createdAt).split(' ')[1]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Profitability Rankings */}
            <div className="bg-white rounded-[2rem] border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0">
              <div className="flex items-center gap-2 text-violet-600 mb-4">
                <Award size={20} />
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Top clases rentables</h3>
              </div>

              <div className="space-y-4">
                {classProfitabilityRanking.length === 0 ? (
                  <div className="text-center py-4 text-xs font-semibold text-gray-500">
                    No hay suficientes datos de clases.
                  </div>
                ) : (
                  classProfitabilityRanking.map((item, index) => {
                    const medalColors = ['bg-amber-100 text-amber-700', 'bg-slate-100 text-slate-700', 'bg-orange-100 text-orange-700'];
                    const rankStyle = index < 3 ? medalColors[index] : 'bg-gray-100 text-gray-600';
                    
                    return (
                      <div key={item.classCode} className="flex items-start gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${rankStyle}`}>
                          {index + 1}
                        </span>
                        
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-900 gap-2">
                            <span className="truncate" title={item.title}>{item.title}</span>
                            <span className="shrink-0">{formatCurrency(item.amount)}</span>
                          </div>
                          
                          <div className="flex justify-between text-[9px] font-bold text-gray-400">
                            <span>{item.classCode} · {item.paymentsCount} pago(s)</span>
                            <span className="text-violet-600">{item.subject}</span>
                          </div>

                          {/* Relative progress line */}
                          <div className="w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-violet-600 h-full rounded-full" style={{ width: `${item.relativeShare}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Weekday vs Weekend comparative widget */}
            <div className="bg-white rounded-[2rem] border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-0.5">Ingresos por periodo semanal</h3>
                <p className="text-xs text-gray-500 font-semibold">Comparativa de rentabilidad: Semana vs Fin de Semana</p>
              </div>

              <div className="space-y-4 my-4">
                {/* Weekdays */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-800">
                    <span>Entre semana (Lun-Vie)</span>
                    <span className="font-extrabold">{formatCurrency(weekdayWeekendComparison.weekdayAmount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${weekdayWeekendComparison.weekdayPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>{weekdayWeekendComparison.weekdayCount} pagos</span>
                    <span className="text-indigo-600 font-black">{weekdayWeekendComparison.weekdayPercentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Weekends */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-800">
                    <span>Fines de semana (Sáb-Dom)</span>
                    <span className="font-extrabold">{formatCurrency(weekdayWeekendComparison.weekendAmount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${weekdayWeekendComparison.weekendPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>{weekdayWeekendComparison.weekendCount} pagos</span>
                    <span className="text-orange-600 font-black">{weekdayWeekendComparison.weekendPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* automatic conclusion */}
              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-[10.5px] font-bold text-gray-500 leading-relaxed shrink-0">
                {weekdayWeekendComparison.weekdayAmount === 0 && weekdayWeekendComparison.weekendAmount === 0 ? (
                  'No hay ingresos registrados en el periodo seleccionado para calcular tendencias.'
                ) : weekdayWeekendComparison.weekdayAmount >= weekdayWeekendComparison.weekendAmount ? (
                  <p>
                    <Activity size={12} className="inline mr-1 text-emerald-600" />
                    Las clases de <span className="text-indigo-600 font-black">Entre Semana</span> representan el pilar de ingresos, generando un <span className="text-indigo-600 font-black">{(weekdayWeekendComparison.weekdayPercentage).toFixed(0)}%</span> del total. Considera expandir horarios en estos días.
                  </p>
                ) : (
                  <p>
                    <Activity size={12} className="inline mr-1 text-emerald-600" />
                    Los <span className="text-orange-600 font-black">Fines de Semana</span> son más rentables en este periodo, acumulando un <span className="text-orange-600 font-black">{(weekdayWeekendComparison.weekendPercentage).toFixed(0)}%</span> del total consolidado.
                  </p>
                )}
              </div>
            </div>

          </div>
        </section>
      </main>
      
      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminStatsPage;
