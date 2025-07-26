import Navbar from "../components/Navbar";
import HeroCarousel from "../components/HeroCarousel";
import CalendarSectionTimeSlots from "../components/CalendarSectionTimeSlots";
import BookingSection from "../components/BookingSection";
import TestimonialsSection from "../components/TestimonialsSection";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div>
      <Navbar />
      <HeroCarousel />
      <CalendarSectionTimeSlots />
      <BookingSection />
      <TestimonialsSection />
      <Footer />
    </div>
  );
}
