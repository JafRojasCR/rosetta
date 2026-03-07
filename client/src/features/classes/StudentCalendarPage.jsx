import { useNavigate } from 'react-router-dom';
import ClassCalendarPanel from '../../components/ClassCalendarPanel';
import useAuth from '../../hooks/useAuth';

const StudentCalendarPage = () => {
  const navigate = useNavigate();
  const { fetchCalendarSlots, reserveCalendarSlot, deleteCalendarSlot } = useAuth();

  return (
    <ClassCalendarPanel
      mode="student"
      onBack={() => navigate('/clases')}
      fetchCalendarSlots={fetchCalendarSlots}
      createAvailability={async () => null}
      reserveSlot={reserveCalendarSlot}
      approveSlot={async () => null}
      deleteSlot={deleteCalendarSlot}
    />
  );
};

export default StudentCalendarPage;
