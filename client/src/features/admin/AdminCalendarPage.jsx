import { useNavigate } from 'react-router-dom';
import ClassCalendarPanel from '../../components/ClassCalendarPanel';
import useAuth from '../../hooks/useAuth';

const AdminCalendarPage = () => {
  const navigate = useNavigate();
  const {
    fetchCalendarSlots,
    createCalendarAvailability,
    approveCalendarSlot,
    deleteCalendarSlot,
  } = useAuth();

  return (
    <ClassCalendarPanel
      mode="admin"
      onBack={() => navigate('/admin/clases')}
      fetchCalendarSlots={fetchCalendarSlots}
      createAvailability={createCalendarAvailability}
      reserveSlot={async () => null}
      approveSlot={approveCalendarSlot}
      deleteSlot={deleteCalendarSlot}
    />
  );
};

export default AdminCalendarPage;
