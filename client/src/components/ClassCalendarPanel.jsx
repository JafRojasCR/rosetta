import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Trash2,
  X,
} from 'lucide-react';

const WEEK_DAYS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const POPUP_MARGIN = 14;
const POPUP_FALLBACK_WIDTH = 360;
const POPUP_FALLBACK_HEIGHT = 360;
const AVAILABLE_RETURN_ANIMATION_MS = 520;
const MOBILE_POPOVER_BREAKPOINT = 900;
const AUTO_SCROLL_STEP_PX = window.innerWidth < MOBILE_POPOVER_BREAKPOINT ? 4 / 3 : 8;
const TOUCH_SELECTION_DELAY_MS = 30;
const COSTA_RICA_TIMEZONE = 'America/Costa_Rica';

const toIsoDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIsoDate = (year, month, day) => {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const toIsoDateInTimeZone = (value, timeZone) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const parseIsoDateParts = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const getCostaRicaTodayIso = () => toIsoDateInTimeZone(new Date(), COSTA_RICA_TIMEZONE);

const minuteToTime = (minute) => {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const minutesForTimeline = () => {
  const result = [];
  for (let minute = 8 * 60; minute <= 22 * 60; minute += 30) {
    result.push(minute);
  }
  return result;
};

const statusLabel = (status) => {
  if (status === 'group') return 'Clase grupal';
  if (status === 'booked') return 'Reservado';
  if (status === 'pending') return 'Pendiente';
  return 'Disponible';
};

const STATUS_PRIORITY = {
  group: 4,
  booked: 3,
  pending: 2,
  available: 1,
};

const pickTopSlotForMinute = (slots = [], minute = 0) => {
  const coveringSlots = slots.filter(
    (slot) => minute >= slot.startMinute && minute < slot.endMinute
  );
  if (coveringSlots.length === 0) return null;

  return [...coveringSlots].sort((a, b) => {
    const priorityDelta = (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0);
    if (priorityDelta !== 0) return priorityDelta;

    const durationA = (a.endMinute || 0) - (a.startMinute || 0);
    const durationB = (b.endMinute || 0) - (b.startMinute || 0);
    if (durationA !== durationB) return durationA - durationB;

    return String(a.id || '').localeCompare(String(b.id || ''));
  })[0];
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getNodeAnchorRect = (node) => {
  if (!node?.getBoundingClientRect) return null;

  const rect = node.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const getEventClientPoint = (event, fallbackNode = null) => {
  if (event) {
    const source = event.nativeEvent || event;
    const touchPoint = source.touches?.[0] || source.changedTouches?.[0] || null;
    const x = touchPoint?.clientX ?? source.clientX;
    const y = touchPoint?.clientY ?? source.clientY;

    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  if (fallbackNode?.getBoundingClientRect) {
    const rect = fallbackNode.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  return null;
};

const ClassCalendarPanel = ({
  mode,
  onBack,
  fetchCalendarSlots,
  createAvailability,
  reserveSlot,
  approveSlot,
  deleteSlot,
}) => {
  const isAdmin = mode === 'admin';
  const todayInCostaRicaIso = getCostaRicaTodayIso() || toIsoDate(new Date());
  const todayInCostaRicaParts = parseIsoDateParts(todayInCostaRicaIso);
  const fallbackNow = new Date();
  const [isVisible, setIsVisible] = useState(false);
  const [requestDetail, setRequestDetail] = useState('');
  const [adminAvailabilityDetail, setAdminAvailabilityDetail] = useState('');

  const [selectedDateKey, setSelectedDateKey] = useState(() => todayInCostaRicaIso);
  const [monthCursor, setMonthCursor] = useState(
    () =>
      new Date(
        todayInCostaRicaParts?.year || fallbackNow.getFullYear(),
        (todayInCostaRicaParts?.month || fallbackNow.getMonth() + 1) - 1,
        1
      )
  );
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelInputFocused, setCancelInputFocused] = useState(false);
  const cancelInputRef = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [activePopover, setActivePopover] = useState(null);
  const [isClosingPopover, setIsClosingPopover] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState({ top: 20, left: 20 });
  const [isMobilePopover, setIsMobilePopover] = useState(false);

  const timelineScrollRef = useRef(null);
  const popoverRef = useRef(null);
  const minuteButtonRefs = useRef({});
  const autoScrollRafRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);
  const lastPointerXRef = useRef(null);
  const isTouchDraggingRef = useRef(false);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchStartScrollLeftRef = useRef(0);
  const touchScrollIntentRef = useRef(false);
  const touchSelectionDelayTimerRef = useRef(null);
  const pendingTouchSelectionRef = useRef(null);
  const timelineTouchStartXRef = useRef(null);
  const timelineTouchStartScrollLeftRef = useRef(0);
  const timelineTouchScrollingRef = useRef(false);
  const popoverCloseTimerRef = useRef(null);
  const availableReturnTimerRef = useRef(null);
  const [returningToAvailableRange, setReturningToAvailableRange] = useState(null);

  const setMinuteButtonRef = useCallback((minute, node) => {
    if (node) {
      minuteButtonRefs.current[minute] = node;
    } else {
      delete minuteButtonRefs.current[minute];
    }
  }, []);

  const monthRange = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const from = toIsoDate(new Date(Date.UTC(year, month, 1)));
    const to = toIsoDate(new Date(Date.UTC(year, month + 1, 0)));
    return { from, to };
  }, [monthCursor]);

  const allTimeSlots = useMemo(() => minutesForTimeline(), []);

  const loadSlots = useCallback(async () => {
    setIsMonthTransitioning(true);
    setError('');

    try {
      const result = await fetchCalendarSlots(monthRange);
      setSlots(result || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el calendario.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsMonthTransitioning(false));
      });
    }
  }, [fetchCalendarSlots, monthRange]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const _hasRunInitialMonthRef = useRef(false);
  useEffect(() => {
    // Avoid overriding the initial date selection on first mount.
    if (!_hasRunInitialMonthRef.current) {
      _hasRunInitialMonthRef.current = true;
      return;
    }

    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstIso = buildIsoDate(year, month, 1);
    setSelectedDateKey(firstIso);
  }, [monthCursor]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));

    return () => {
      cancelAnimationFrame(id);
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
      if (popoverCloseTimerRef.current) {
        clearTimeout(popoverCloseTimerRef.current);
      }
      if (touchSelectionDelayTimerRef.current) {
        clearTimeout(touchSelectionDelayTimerRef.current);
      }
      if (availableReturnTimerRef.current) {
        clearTimeout(availableReturnTimerRef.current);
      }
    };
  }, []);

  const monthCalendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekDay; i += 1) {
      cells.push({ key: `empty-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = buildIsoDate(year, month, day);
      const slotsForDay = slots.filter((slot) => slot.date === iso);
      const hasGroup = slotsForDay.some((slot) => slot.status === 'group');
      const hasBooked = slotsForDay.some((slot) => slot.status === 'booked');
      const hasPending = slotsForDay.some((slot) => slot.status === 'pending');
      let hasAvailable = false;
      for (let minute = 0; minute < 24 * 60; minute += 30) {
        const topSlot = pickTopSlotForMinute(slotsForDay, minute);
        if (topSlot?.status === 'available') {
          hasAvailable = true;
          break;
        }
      }

      cells.push({
        key: iso,
        empty: false,
        day,
        iso,
        hasGroup,
        hasAvailable,
        hasBooked,
        hasPending,
      });
    }

    return cells;
  }, [monthCursor, slots]);

  const daySlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.date === selectedDateKey)
        .sort((a, b) => a.startMinute - b.startMinute),
    [slots, selectedDateKey]
  );

  const slotByMinute = useMemo(() => {
    const map = new Map();
    allTimeSlots.forEach((minute) => {
      const topSlot = pickTopSlotForMinute(daySlots, minute);
      if (!topSlot) return;

      if (!isAdmin && (topSlot.status === 'pending' || topSlot.status === 'booked')) {
        const isOwnSlot = Boolean(topSlot.isOwner);
        map.set(minute, {
          ...topSlot,
          student: null,
          detail: isOwnSlot
            ? topSlot.detail || 'Solicitud en revision'
            : topSlot.status === 'pending'
              ? 'Horario en revision'
              : 'Horario reservado',
          canDelete: isOwnSlot,
        });
        return;
      }

      map.set(minute, topSlot);
    });

    return map;
  }, [allTimeSlots, daySlots, isAdmin]);

  const visibleDaySlots = useMemo(() => {
    const blocks = [];
    let current = null;

    allTimeSlots.forEach((minute) => {
      const slot = slotByMinute.get(minute) || null;

      if (!slot) {
        if (current) {
          blocks.push(current);
          current = null;
        }
        return;
      }

      const nextEnd = minute + 30;
      if (
        current &&
        current.id === slot.id &&
        current.status === slot.status &&
        current.endMinute === minute
      ) {
        current.endMinute = nextEnd;
        return;
      }

      if (current) {
        blocks.push(current);
      }

      current = {
        ...slot,
        startMinute: minute,
        endMinute: nextEnd,
      };
    });

    if (current) {
      blocks.push(current);
    }

    return blocks;
  }, [allTimeSlots, slotByMinute]);

  const hasCollision = (startMinute, endMinute) =>
    daySlots.some((slot) => startMinute < slot.endMinute && endMinute > slot.startMinute);

  const getAvailabilitySlotCovering = (startMinute, endMinute) =>
    daySlots.find(
      (slot) =>
        slot.status === 'available' &&
        slot.startMinute <= startMinute &&
        slot.endMinute >= endMinute
    );

  const canStudentSelectRange = (startMinute, endMinute) => {
    const range = endMinute - startMinute;
    if (range > 180) return false;

    const ownedReservedMinutes = daySlots
      .filter((slot) => (slot.status === 'pending' || slot.status === 'booked') && slot.isOwner)
      .reduce((total, slot) => total + Math.max(0, slot.endMinute - slot.startMinute), 0);

    if (ownedReservedMinutes + range > 180) return false;

    const coveringSlot = getAvailabilitySlotCovering(startMinute, endMinute);
    if (!coveringSlot) return false;

    const blocked = daySlots.some(
      (slot) =>
        (slot.status === 'pending' || slot.status === 'booked') &&
        startMinute < slot.endMinute &&
        endMinute > slot.startMinute
    );

    return !blocked;
  };

  const closePopover = useCallback(() => {
    if (!activePopover) return;
    setIsClosingPopover(true);
    if (popoverCloseTimerRef.current) {
      clearTimeout(popoverCloseTimerRef.current);
    }
    popoverCloseTimerRef.current = setTimeout(() => {
      setActivePopover(null);
      setIsClosingPopover(false);
      popoverCloseTimerRef.current = null;
      setCancelReason('');
      setShowCancelInput(false);
    }, 170);
  }, [activePopover]);

  const stopAutoScroll = useCallback(() => {
    autoScrollDirectionRef.current = 0;
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const updateDragEndFromPointer = useCallback(
    (clientX) => {
      if (!Number.isFinite(clientX)) return;
      let nearestMinute = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      allTimeSlots.forEach((minute) => {
        const node = minuteButtonRefs.current[minute];
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(centerX - clientX);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestMinute = minute;
        }
      });

      if (nearestMinute !== null) {
        setDragEnd(nearestMinute);
      }
    },
    [allTimeSlots]
  );

  const stepAutoScroll = useCallback(() => {
    if (!isDragging) {
      stopAutoScroll();
      return;
    }

    const container = timelineScrollRef.current;
    const direction = autoScrollDirectionRef.current;
    if (!container || direction === 0) {
      stopAutoScroll();
      return;
    }

    const before = container.scrollLeft;
    container.scrollLeft = before + direction * AUTO_SCROLL_STEP_PX;

    if (lastPointerXRef.current !== null) {
      updateDragEndFromPointer(lastPointerXRef.current);
    }

    if (container.scrollLeft === before) {
      stopAutoScroll();
      return;
    }

    autoScrollRafRef.current = requestAnimationFrame(stepAutoScroll);
  }, [isDragging, stopAutoScroll, updateDragEndFromPointer]);

  const startAutoScroll = useCallback(
    (direction) => {
      if (!direction) {
        stopAutoScroll();
        return;
      }

      autoScrollDirectionRef.current = direction;
      if (!autoScrollRafRef.current) {
        autoScrollRafRef.current = requestAnimationFrame(stepAutoScroll);
      }
    },
    [stepAutoScroll, stopAutoScroll]
  );

  const resetSelection = useCallback(() => {
    stopAutoScroll();
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [stopAutoScroll]);

  const openPopover = useCallback(
    (nextPopover) => {
      if (popoverCloseTimerRef.current) {
        clearTimeout(popoverCloseTimerRef.current);
        popoverCloseTimerRef.current = null;
      }
      setIsClosingPopover(false);
      setActivePopover(nextPopover);

      if (nextPopover?.type === 'new-pending') {
        setRequestDetail(String(nextPopover.detail || ''));
      }

      if (nextPopover?.type === 'new-available') {
        setAdminAvailabilityDetail(String(nextPopover.detail || ''));
      }

      if (nextPopover?.type === 'existing') {
        setCancelReason('');
        setShowCancelInput(false);
      }
    },
    []
  );

  const triggerAvailableReturnAnimation = useCallback((slot) => {
    if (!slot || slot.status === 'available') return;

    if (availableReturnTimerRef.current) {
      clearTimeout(availableReturnTimerRef.current);
    }

    setReturningToAvailableRange({
      date: slot.date,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      token: `${slot.id}-${Date.now()}`,
    });

    availableReturnTimerRef.current = setTimeout(() => {
      setReturningToAvailableRange(null);
      availableReturnTimerRef.current = null;
    }, AVAILABLE_RETURN_ANIMATION_MS);
  }, []);

  const clearPendingTouchSelection = useCallback(() => {
    if (touchSelectionDelayTimerRef.current) {
      clearTimeout(touchSelectionDelayTimerRef.current);
      touchSelectionDelayTimerRef.current = null;
    }
    pendingTouchSelectionRef.current = null;
  }, []);

  const beginSelection = useCallback(
    ({ minute, point, isTouch }) => {
      if (typeof minute !== 'number') return false;

      setError('');
      setMessage('');

      if (activePopover) {
        closePopover();
      }

      if (isAdmin) {
        const occupied = daySlots.some(
          (slot) => minute >= slot.startMinute && minute < slot.endMinute
        );
        if (occupied) return false;
      } else {
        const insideAvailable = daySlots.some(
          (slot) =>
            slot.status === 'available' &&
            minute >= slot.startMinute &&
            minute < slot.endMinute
        );
        if (!insideAvailable) return false;

        const blocked = daySlots.some(
          (slot) =>
            (slot.status === 'pending' || slot.status === 'booked') &&
            minute >= slot.startMinute &&
            minute < slot.endMinute
        );
        if (blocked) return false;
      }

      setIsDragging(true);
      setDragStart(minute);
      setDragEnd(minute);
      lastPointerXRef.current = Number.isFinite(point?.x) ? point.x : null;

      if (isTouch) {
        const container = timelineScrollRef.current;
        isTouchDraggingRef.current = true;
        touchScrollIntentRef.current = false;
        touchStartXRef.current = point?.x ?? null;
        touchStartYRef.current = point?.y ?? null;
        touchStartScrollLeftRef.current = container?.scrollLeft || 0;
      } else {
        isTouchDraggingRef.current = false;
        touchScrollIntentRef.current = false;
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchStartScrollLeftRef.current = 0;
      }

      return true;
    },
    [activePopover, closePopover, daySlots, isAdmin]
  );

  const handleMouseDown = (minute, event) => {
    event.preventDefault();
    const point = getEventClientPoint(event, event.currentTarget);
    beginSelection({ minute, point, isTouch: false });
  };

  const handleBarTouchStart = (minute, event) => {
    const point = getEventClientPoint(event, event.currentTarget);
    clearPendingTouchSelection();
    pendingTouchSelectionRef.current = { minute, point };

    touchSelectionDelayTimerRef.current = setTimeout(() => {
      const pending = pendingTouchSelectionRef.current;
      if (!pending) return;

      beginSelection({
        minute: pending.minute,
        point: pending.point,
        isTouch: true,
      });
      clearPendingTouchSelection();
    }, TOUCH_SELECTION_DELAY_MS);
  };

  const handleTimelineTouchStart = (event) => {
    if (window.innerWidth > MOBILE_POPOVER_BREAKPOINT || isDragging) return;

    const target = event.target;
    if (target instanceof Element && target.closest('[data-time-bar="true"]')) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    timelineTouchScrollingRef.current = true;
    timelineTouchStartXRef.current = touch.clientX;
    timelineTouchStartScrollLeftRef.current = timelineScrollRef.current?.scrollLeft || 0;
  };

  const handleTimelineTouchMove = (event) => {
    if (!timelineTouchScrollingRef.current) return;
    if (window.innerWidth > MOBILE_POPOVER_BREAKPOINT) return;

    const touch = event.touches?.[0];
    if (!touch || !timelineScrollRef.current || !Number.isFinite(timelineTouchStartXRef.current)) return;

    const deltaX = touch.clientX - timelineTouchStartXRef.current;
    timelineScrollRef.current.scrollLeft = timelineTouchStartScrollLeftRef.current - deltaX;
    event.preventDefault();
  };

  const handleTimelineTouchEnd = () => {
    timelineTouchScrollingRef.current = false;
    timelineTouchStartXRef.current = null;
  };

  const handleMouseEnter = (minute) => {
    if (!isDragging) return;
    setDragEnd(minute);
  };

  const handleBarTouchMove = (event) => {
    if (!isDragging) return;

    const point = getEventClientPoint(event);
    if (!point) return;

    lastPointerXRef.current = point.x;
    updateDragEndFromPointer(point.x);

    const container = timelineScrollRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const threshold = 46;
    if (point.x > rect.right - threshold) {
      startAutoScroll(1);
    } else if (point.x < rect.left + threshold) {
      startAutoScroll(-1);
    } else {
      stopAutoScroll();
    }

    event.preventDefault();
  };

  const handleMouseUp = (event) => {
    clearPendingTouchSelection();
    stopAutoScroll();

    const cancelledByTouchScroll = touchScrollIntentRef.current;
    isTouchDraggingRef.current = false;
    touchScrollIntentRef.current = false;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchStartScrollLeftRef.current = 0;

    if (cancelledByTouchScroll) {
      resetSelection();
      return;
    }

    if (!isDragging || dragStart === null || dragEnd === null) return;

    const startMinute = Math.min(dragStart, dragEnd);
    const endMinute = Math.max(dragStart, dragEnd) + 30;
    const anchorMinute = Math.max(dragStart, dragEnd);
    let pointer = getEventClientPoint(event);
    const anchorNode = minuteButtonRefs.current[anchorMinute];
    const anchorRect = getNodeAnchorRect(anchorNode);
    if (!pointer && anchorMinute !== null && anchorMinute !== undefined) {
      pointer = getEventClientPoint(null, anchorNode);
    }

    setIsDragging(false);

    if (isAdmin) {
      if (hasCollision(startMinute, endMinute)) {
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      openPopover({
        type: 'new-available',
        startMinute,
        endMinute,
        anchorMinute,
        anchorRect,
        pointer,
      });
      return;
    }

    if (!canStudentSelectRange(startMinute, endMinute)) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    openPopover({
      type: 'new-pending',
      startMinute,
      endMinute,
      anchorMinute,
      anchorRect,
      pointer,
    });
  };

  const handleOpenExisting = (slot, event, minute = null) => {
    const minuteNode = minute !== null && minute !== undefined ? minuteButtonRefs.current[minute] : null;
    const anchorNode = event?.currentTarget || minuteNode || minuteButtonRefs.current[slot?.startMinute] || null;
    const pointer = getEventClientPoint(event, anchorNode);
    const anchorRect = getNodeAnchorRect(anchorNode) || getNodeAnchorRect(minuteNode);

    openPopover({
      type: 'existing',
      slot,
      anchorMinute: minute ?? slot?.startMinute ?? null,
      anchorRect,
      pointer,
    });
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMove = (event) => {
      lastPointerXRef.current = event.clientX;
      updateDragEndFromPointer(event.clientX);

      const container = timelineScrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const threshold = 46;

      if (event.clientX > rect.right - threshold) {
        startAutoScroll(1);
      } else if (event.clientX < rect.left + threshold) {
        startAutoScroll(-1);
      } else {
        stopAutoScroll();
      }
    };

    const handleStop = () => {
      stopAutoScroll();
    };

    const handleTouchMove = (event) => {
      const point = getEventClientPoint(event);
      if (!point) return;

      lastPointerXRef.current = point.x;
      updateDragEndFromPointer(point.x);

      const container = timelineScrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const threshold = 46;
      if (point.x > rect.right - threshold) {
        startAutoScroll(1);
      } else if (point.x < rect.left + threshold) {
        startAutoScroll(-1);
      } else {
        stopAutoScroll();
      }
    };

    const handleTouchEnd = () => {
      stopAutoScroll();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleStop);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleStop);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      stopAutoScroll();
    };
  }, [isDragging, startAutoScroll, stopAutoScroll, updateDragEndFromPointer]);

  const getAnchorGeometry = useCallback(() => {
    if (!activePopover) {
      return { centerX: 24, top: 24, bottom: 24 };
    }

    if (activePopover.anchorRect) {
      return {
        centerX: activePopover.anchorRect.left + activePopover.anchorRect.width / 2,
        top: activePopover.anchorRect.top,
        bottom: activePopover.anchorRect.bottom,
      };
    }

    if (activePopover.anchorMinute !== null && activePopover.anchorMinute !== undefined) {
      const node = minuteButtonRefs.current[activePopover.anchorMinute];
      const rect = getNodeAnchorRect(node);
      if (rect) {
        return {
          centerX: rect.left + rect.width / 2,
          top: rect.top,
          bottom: rect.bottom,
        };
      }
    }

    if (activePopover.pointer) {
      return {
        centerX: activePopover.pointer.x,
        top: activePopover.pointer.y,
        bottom: activePopover.pointer.y,
      };
    }

    return { centerX: 24, top: 24, bottom: 24 };
  }, [activePopover]);

  const updatePopoverPosition = useCallback(() => {
    if (!activePopover) return;

    const width = popoverRef.current?.offsetWidth || POPUP_FALLBACK_WIDTH;
    const height = popoverRef.current?.offsetHeight || POPUP_FALLBACK_HEIGHT;

    if (window.innerWidth <= MOBILE_POPOVER_BREAKPOINT) {
      setIsMobilePopover(true);
      const centeredLeft = clamp(
        (window.innerWidth - width) / 2,
        POPUP_MARGIN,
        window.innerWidth - width - POPUP_MARGIN
      );
      const centeredTop = clamp(
        (window.innerHeight - height) / 2,
        POPUP_MARGIN,
        window.innerHeight - height - POPUP_MARGIN
      );
      setPopoverCoords({ top: centeredTop, left: centeredLeft });
      return;
    }

    setIsMobilePopover(false);

    const anchor = getAnchorGeometry();

    const nextLeft = clamp(
      anchor.centerX - width / 2,
      POPUP_MARGIN,
      window.innerWidth - width - POPUP_MARGIN
    );
    const preferredTop = anchor.top - height - 12;
    const fallbackBelowTop = anchor.bottom + 12;
    const nextTop = clamp(
      preferredTop >= POPUP_MARGIN ? preferredTop : fallbackBelowTop,
      POPUP_MARGIN,
      window.innerHeight - height - POPUP_MARGIN
    );

    setPopoverCoords({ top: nextTop, left: nextLeft });
  }, [activePopover, getAnchorGeometry]);

  useEffect(() => {
    if (!activePopover) return undefined;

    updatePopoverPosition();

    const onResize = () => updatePopoverPosition();
    const onScroll = () => updatePopoverPosition();

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    timelineScrollRef.current?.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      timelineScrollRef.current?.removeEventListener('scroll', onScroll);
    };
  }, [activePopover, updatePopoverPosition]);

  useEffect(() => {
    if (!activePopover) {
      setIsMobilePopover(false);
    }
  }, [activePopover]);

  const handleSaveNewBlock = async () => {
    if (!activePopover) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (activePopover.type === 'new-available') {
        const trimmedDetail = adminAvailabilityDetail.trim();
        const slotType = trimmedDetail ? 'group' : 'available';
        await createAvailability({
          date: selectedDateKey,
          startMinute: activePopover.startMinute,
          endMinute: activePopover.endMinute,
          slotType,
          detail: trimmedDetail || 'Horario habilitado',
        });
        setMessage(
          slotType === 'group' ? 'Clase grupal creada en el calendario.' : 'Bloque disponible creado.'
        );
      }

      if (activePopover.type === 'new-pending') {
        await reserveSlot({
          date: selectedDateKey,
          startMinute: activePopover.startMinute,
          endMinute: activePopover.endMinute,
          detail: requestDetail.trim() || 'Solicitud de clase',
        });
        setMessage('Solicitud enviada al administrador.');
      }

      resetSelection();
      setRequestDetail('');
      setAdminAvailabilityDetail('');
      closePopover();
      await loadSlots();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el bloque.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (slotId) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await approveSlot(slotId);
      setMessage('Solicitud aprobada correctamente.');
      resetSelection();
      closePopover();
      await loadSlots();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo aprobar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slotId, reason = null) => {
    setSaving(true);
    setError('');
    setMessage('');

    const slotToDelete =
      activePopover?.type === 'existing' && activePopover.slot?.id === slotId
        ? activePopover.slot
        : slots.find((slot) => slot.id === slotId) || null;

    try {
      if (reason && typeof deleteSlot === 'function') {
        await deleteSlot(slotId, { reason });
      } else {
        await deleteSlot(slotId);
      }
      setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
      triggerAvailableReturnAnimation(slotToDelete);
      setMessage('Bloque eliminado correctamente.');
      resetSelection();
      closePopover();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar el bloque.');
    } finally {
      setSaving(false);
    }
  };

  const monthTitle = `${MONTHS[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;

  return (
    <div
      className={`calendar-panel-root min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
          @keyframes popIn {
            0% { opacity: 0; transform: translateY(8px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes popOut {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(8px) scale(0.96); }
          }
          @keyframes slotPulseIn {
            0% { opacity: 0; transform: translateY(8px) scaleY(0.94); }
            100% { opacity: 1; transform: translateY(0) scaleY(1); }
          }
          @keyframes slotReturnAvailable {
            0% { transform: translateY(-10px) scaleY(0.9); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
            55% { transform: translateY(0) scaleY(1.04); box-shadow: 0 0 0 14px rgba(59, 130, 246, 0); }
            100% { transform: translateY(0) scaleY(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          }
          .calendar-panel-root,
          .calendar-panel-root * {
            font-family: 'Poppins', 'Inter', system-ui, sans-serif;
          }
          .calendar-panel-portal,
          .calendar-panel-portal * {
            font-family: 'Poppins', 'Inter', system-ui, sans-serif;
          }

          /* Thin horizontal scrollbar for the 30-minute timeline wrapper (thumb-focused). */
          .timeline-blocks-scroll {
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding-bottom: 8px;
            scrollbar-gutter: stable;
            -ms-overflow-style: auto !important;
            scrollbar-width: thin !important;
            scrollbar-color: rgba(148,163,184,0.85) transparent !important;
          }

          .timeline-blocks-scroll::-webkit-scrollbar {
            height: 6px !important;
            width: 0 !important;
            display: block !important;
            background: transparent !important;
          }

          .timeline-blocks-scroll::-webkit-scrollbar-track {
            background: transparent !important;
            margin: 0 16px 1px 16px;
          }

          .timeline-blocks-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(148,163,184,0.85) !important;
            border-radius: 9999px;
            border: 1px solid transparent;
            background-clip: padding-box;
          }

          .timeline-blocks-scroll::-webkit-scrollbar-thumb:hover {
            background-color: rgba(100,116,139,0.95) !important;
          }

          .timeline-blocks-scroll::-webkit-scrollbar-button,
          .timeline-blocks-scroll::-webkit-scrollbar-corner,
          .timeline-blocks-scroll::-webkit-resizer {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            background: transparent !important;
          }
        `}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={22} className="text-slate-500" />
          </button>

          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">Calendario</h1>
          </div>
        </div>

        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <CalendarDays size={24} />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 space-y-6">
          <div
            className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all duration-300 ${
              isMonthTransitioning ? 'opacity-45 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{monthTitle}</h2>
              <div className="flex items-center gap-2">
                {isMonthTransitioning && (
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 animate-pulse">
                    Actualizando
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMonthTransitioning(true);
                    setMonthCursor((prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    );
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMonthTransitioning(true);
                    setMonthCursor((prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    );
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center">
              {WEEK_DAYS.map((dayName) => (
                <span key={dayName} className="text-[10px] font-black text-slate-300 tracking-widest pb-3">
                  {dayName}
                </span>
              ))}

              {monthCalendarDays.map((cell) => {
                if (cell.empty) {
                  return <div key={cell.key} className="h-12" />;
                }

                const isSelected = cell.iso === selectedDateKey;
                return (
                  <div key={cell.key} className="flex flex-col items-center mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDateKey(cell.iso)}
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-lg'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cell.day}
                    </button>
                    <div className="h-2 mt-1 flex gap-1">
                      {cell.hasGroup && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                      {cell.hasBooked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {cell.hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {cell.hasAvailable && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`bg-slate-900 p-6 rounded-[2rem] text-white transition-all duration-300 ${
              isMonthTransitioning ? 'opacity-45 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Info className="text-blue-400" size={20} /> Resumen del Día
            </h3>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {visibleDaySlots.length === 0 ? (
                <div className="text-slate-500 text-sm py-8 text-center italic">No hay bloques para este dia</div>
              ) : (
                visibleDaySlots.map((slot) => (
                  <button
                    type="button"
                    key={`${slot.id}-${slot.startMinute}`}
                    onClick={(event) => handleOpenExisting(slot, event, slot.startMinute)}
                    className="w-full text-left p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                          slot.status === 'group'
                            ? 'bg-violet-500/20 text-violet-300'
                            : slot.status === 'booked'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : slot.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {statusLabel(slot.status)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {minuteToTime(slot.startMinute)} - {minuteToTime(slot.endMinute)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">
                      {isAdmin
                        ? slot.student?.email
                          ? `${slot.student.name || ''} ${slot.student.lastName || ''}`.trim() || slot.student.email
                          : slot.status === 'group'
                            ? 'Clase grupal'
                            : 'Bloque disponible'
                        : slot.status === 'available'
                          ? 'Disponible'
                          : slot.status === 'group'
                            ? 'Clase grupal'
                          : statusLabel(slot.status)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{slot.detail || '-'}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-8 space-y-5">
          {error && <div className="bg-red-50 text-red-700 rounded-2xl p-4 font-semibold">{error}</div>}
          {message && <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-4 font-semibold">{message}</div>}

          <div
            className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-sm transition-all duration-300 ${
              isMonthTransitioning ? 'opacity-45 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <div
              className="timeline-blocks-scroll mx-3 mb-2"
              ref={timelineScrollRef}
              onTouchStart={handleTimelineTouchStart}
              onTouchMove={handleTimelineTouchMove}
              onTouchEnd={handleTimelineTouchEnd}
            >
              <div className="p-8 min-w-max">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Linea Horaria del Dia</h3>
                  <p className="text-xs text-slate-500 font-semibold">Arrastra para crear o solicitar bloques de 30 minutos hasta 3 horas por día</p>
                </div>
              </div>

              <div className="flex gap-3 items-end h-[310px] pb-20">
                {allTimeSlots.map((minute) => {
                  const slot = slotByMinute.get(minute) || null;
                  const isPopoverActive = activePopover?.slot?.id === slot?.id;
                  const isReturningToAvailable =
                    slot?.status === 'available' &&
                    returningToAvailableRange?.date === selectedDateKey &&
                    minute >= returningToAvailableRange.startMinute &&
                    minute < returningToAvailableRange.endMinute;

                  const isBeingSelected =
                    isDragging && dragStart !== null && dragEnd !== null
                      ? minute >= Math.min(dragStart, dragEnd) && minute <= Math.max(dragStart, dragEnd)
                      : false;

                  const isPendingPreview =
                    activePopover?.type === 'new-pending' &&
                    minute >= activePopover.startMinute &&
                    minute < activePopover.endMinute;

                  const shouldPaintStudentGreen = !isAdmin && (isBeingSelected || isPendingPreview);

                  return (
                    <div key={minute} className="relative flex flex-col items-center">
                      <div
                        className={`absolute -bottom-[4.2rem] flex flex-col items-center leading-none ${
                          minute % 60 === 0 ? 'text-slate-500' : 'text-slate-300'
                        }`}
                      >
                        <span className="text-[10px] font-bold">{minuteToTime(minute)}</span>
                        <span className="text-[9px] font-black my-0.5">a</span>
                        <span className="text-[10px] font-bold">{minuteToTime(minute + 30)}</span>
                      </div>

                      <button
                        type="button"
                        ref={(node) => setMinuteButtonRef(minute, node)}
                        onMouseDown={(event) => handleMouseDown(minute, event)}
                        onTouchStart={(event) => handleBarTouchStart(minute, event)}
                        onTouchMove={handleBarTouchMove}
                        onMouseEnter={() => handleMouseEnter(minute)}
                        onClick={(event) => slot && handleOpenExisting(slot, event, minute)}
                        data-time-bar="true"
                        className={`w-9 h-56 rounded-full transition-all duration-200 cursor-pointer ${
                          shouldPaintStudentGreen
                            ? 'bg-emerald-100 border-[3px] border-emerald-500 border-dashed ring-[5px] ring-emerald-200/60'
                            : slot
                            ? slot.status === 'group'
                              ? `bg-violet-500 border-[3px] border-violet-600 ring-[5px] ring-violet-300/40 ${isPopoverActive ? 'ring-violet-400/60' : ''}`
                              : slot.status === 'booked'
                              ? `bg-emerald-500 border-[3px] border-emerald-600 ring-[5px] ring-blue-300/40 ${isPopoverActive ? 'ring-blue-400/60' : ''}`
                              : slot.status === 'pending'
                                ? `bg-amber-500 border-[3px] border-amber-600 ring-[5px] ring-blue-300/40 ${isPopoverActive ? 'ring-blue-400/60' : ''}`
                                : `bg-blue-600 border-[3px] border-blue-700 ring-[5px] ring-blue-300/40 ${isPopoverActive ? 'ring-blue-400/60' : ''}`
                            : isBeingSelected
                              ? isAdmin
                                ? 'bg-blue-50 border-[3px] border-blue-500 border-dashed ring-[5px] ring-blue-200/50'
                                : 'bg-emerald-100 border-[3px] border-emerald-500 border-dashed ring-[5px] ring-emerald-200/60'
                              : 'bg-slate-50 border-transparent hover:bg-slate-100 cursor-crosshair'
                        }`}
                        style={{
                          animation: isReturningToAvailable
                            ? 'slotReturnAvailable 520ms cubic-bezier(0.2, 0.85, 0.25, 1)'
                            : 'slotPulseIn 240ms ease-out',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row items-start gap-4 text-slate-600">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="w-full">
              <p className="text-sm font-bold text-slate-900">Leyenda de horarios</p>
              <div className="mt-2 grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-[11px] uppercase font-black tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Reservado
                </span>
                <span className="flex items-center gap-1.5 text-amber-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Pendiente
                </span>
                <span className="flex items-center gap-1.5 text-violet-500">
                  <span className="w-2 h-2 rounded-full bg-violet-500" /> Clase grupal
                </span>
                <span className="flex items-center gap-1.5 text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Disponible
                </span>
              </div>
              {!isAdmin && (
                <p className="text-xs text-slate-500 mt-3">
                  Solo puedes seleccionar intervalos de 30 minutos y un maximo de 3 horas por dia.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {activePopover && createPortal(
        <div
          className={`calendar-panel-portal fixed inset-0 z-[130] ${isMobilePopover ? 'flex items-center justify-center px-3' : 'pointer-events-none'}`}
        >
          <div
            ref={popoverRef}
            className={`w-[min(92vw,360px)] ${isMobilePopover ? 'pointer-events-auto' : 'fixed'}`}
            style={
              isMobilePopover
                ? {
                    animation: `${isClosingPopover ? 'popOut' : 'popIn'} 170ms ease forwards`,
                  }
                : {
                    top: `${popoverCoords.top}px`,
                    left: `${popoverCoords.left}px`,
                    animation: `${isClosingPopover ? 'popOut' : 'popIn'} 170ms ease forwards`,
                  }
            }
          >
            <div className="bg-white border border-slate-100 shadow-[0_30px_60px_rgba(0,0,0,0.25)] rounded-[2.2rem] p-6 pointer-events-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="p-2.5 bg-slate-50 text-slate-500 rounded-2xl">
                <Clock size={18} />
              </div>
              <button
                type="button"
                onClick={closePopover}
                className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            {activePopover.type === 'existing' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    {statusLabel(activePopover.slot.status)}
                  </p>
                  <h4 className="text-lg font-bold text-slate-900 mt-1">
                    {minuteToTime(activePopover.slot.startMinute)} - {minuteToTime(activePopover.slot.endMinute)}
                  </h4>
                  <p className="text-xs text-slate-500 mt-2">{activePopover.slot.detail || '-'}</p>
                  {isAdmin && activePopover.slot.student?.email && (
                    <p className="text-xs text-slate-500 mt-1">
                      Estudiante: {activePopover.slot.student.name} {activePopover.slot.student.lastName} ({activePopover.slot.student.email})
                    </p>
                  )}
                </div>

                {isAdmin ? (
                  <div className="grid grid-cols-2 gap-3">
                    {activePopover.slot.status === 'pending' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleApprove(activePopover.slot.id)}
                        className="bg-emerald-500 text-white py-3 rounded-2xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-60"
                      >
                        <Check size={18} />
                      </button>
                    )}

                    {(() => {
                      const studentOwned = Boolean(activePopover.slot.student?.email);
                      const isPendingOrBooked = activePopover.slot.status === 'pending' || activePopover.slot.status === 'booked';
                      const requiresReason = studentOwned && isPendingOrBooked;

                      if (!requiresReason) {
                        // Default immediate delete for available/group or non-student slots
                        return (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleDelete(activePopover.slot.id)}
                            className={`${
                              activePopover.slot.status === 'pending' ? 'col-span-1' : 'col-span-2'
                            } bg-red-50 text-red-600 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-60`}
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        );
                      }

                      // Special behavior: show floating input only on hover over wrapper
                      return (
                        <div
                          className={`relative ${activePopover.slot.status === 'pending' ? 'col-span-1' : 'col-span-2'}`}
                          onMouseEnter={() => setShowCancelInput(true)}
                          onMouseLeave={() => { if (!cancelInputFocused && !cancelReason) setShowCancelInput(false); }}
                        >
                          <div
                            className="absolute left-1/2 -translate-x-1/2 -top-20 w-[280px] z-30 pointer-events-auto"
                            style={{
                              transition: 'all 220ms cubic-bezier(0.2,0.9,0.2,1)',
                              transform: showCancelInput || cancelReason || cancelInputFocused ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(-6px) scale(0.96)',
                              opacity: showCancelInput || cancelReason || cancelInputFocused ? 1 : 0,
                            }}
                          >
                            <div className="bg-white border border-red-100 shadow-sm rounded-2xl p-3">
                              <label className="text-[11px] font-black uppercase tracking-widest text-red-500 mb-1 block">Razón de cancelación</label>
                              <input
                                ref={cancelInputRef}
                                type="text"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                onFocus={() => { setCancelInputFocused(true); setShowCancelInput(true); }}
                                onBlur={() => { setCancelInputFocused(false); /* keep visible if there's text */ if (!cancelReason) setShowCancelInput(false); }}
                                placeholder="Motivo breve..."
                                maxLength={240}
                                className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-400"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={saving || !(String(cancelReason || '').trim())}
                            onClick={() => handleDelete(activePopover.slot.id, String(cancelReason || '').trim())}
                            className="w-full bg-red-50 text-red-600 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {(activePopover.slot.status === 'pending' || activePopover.slot.status === 'booked') && activePopover.slot.canDelete && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleDelete(activePopover.slot.id)}
                        className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition-colors disabled:opacity-60"
                      >
                        {activePopover.slot.status === 'pending' ? 'Cancelar solicitud' : 'Cancelar clase agendada'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={closePopover}
                      className="w-full bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            )}

            {(activePopover.type === 'new-available' || activePopover.type === 'new-pending') && (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">
                    {activePopover.type === 'new-available' ? 'Habilitar horas' : 'Solicitar horas'}
                  </p>
                  <h4 className="text-lg font-bold text-slate-900 mt-1">
                    {minuteToTime(activePopover.startMinute)} - {minuteToTime(activePopover.endMinute)}
                  </h4>
                </div>

                {activePopover.type === 'new-pending' && (
                  <div className="space-y-2">
                    <label htmlFor="request-detail" className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Detalle
                    </label>
                    <input
                      id="request-detail"
                      type="text"
                      value={requestDetail}
                      onChange={(event) => setRequestDetail(event.target.value)}
                      placeholder="Ej. Refuerzo de condicionales"
                      maxLength={120}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {activePopover.type === 'new-available' && isAdmin && (
                  <div className="space-y-2">
                    <label htmlFor="admin-availability-detail" className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Detalle para clase grupal (opcional)
                    </label>
                    <input
                      id="admin-availability-detail"
                      type="text"
                      value={adminAvailabilityDetail}
                      onChange={(event) => setAdminAvailabilityDetail(event.target.value)}
                      placeholder="Ej. Práctica de Examen"
                      maxLength={140}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-500"
                    />
                    <p className="text-xs text-slate-500">
                      Si escribes un detalle, el bloque se publicara como clase grupal en morado.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveNewBlock}
                    className="bg-emerald-500 text-white py-3 rounded-2xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closePopover}
                    className="bg-red-500 text-white py-3 rounded-2xl flex items-center justify-center hover:bg-red-600 disabled:opacity-60"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>

      {loading && <div className="h-2" />}
    </div>
  );
};

export default ClassCalendarPanel;
