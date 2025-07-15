import Navbar from "../components/Navbar";
import HeroCarousel from "../components/HeroCarousel";
import CalendarSection from "../components/CalendarSection";
import BookingSection from "../components/BookingSection";
import TestimonialsSection from "../components/TestimonialsSection";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div>
      <Navbar />
      <HeroCarousel />
      <CalendarSection />
      <BookingSection />
      <TestimonialsSection />
      <Footer />
    </div>
  );
}
