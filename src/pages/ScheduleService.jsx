import Navbar from "../components/Navbar";
import CalendarSectionTimeSlots from "../components/CalendarSectionTimeSlots";
import Footer from "../components/Footer";
import "../styles/Schedule.css";

export default function ScheduleService() {
  return (
    <div>
      <Navbar />
      <div className="schedule-page">
        <CalendarSectionTimeSlots />
      </div>
      <Footer />
    </div>
  );
}