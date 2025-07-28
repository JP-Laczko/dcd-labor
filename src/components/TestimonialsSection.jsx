import { useEffect, useState } from "react";
import "../styles/Testimonials.css";

const testimonials = [
  {
    name: "Jean A.",
    review:
      "I was so impressed with these young men. They exceeded my expectations. I highly recommend them. I will definitely be calling on them again and again for my future projects!",
  },
  {
    name: "Carmen B.",
    review:
      "Couldn't be more pleased. The team was very professional, courteous and efficient. Highly recommend this company.",
  },
  {
    name: "Lisa N.",
    review:
      "Great bunch of young men... I was an earlier customer when they first started out mowing... Happy to see their business growing! I highly recommend.",
  },
  {
    name: "Michael R.",
    review:
      "Outstanding service from start to finish. The team arrived on time, worked efficiently, and left my yard looking better than I ever imagined. Will definitely use again!",
  },
  {
    name: "Sarah T.",
    review:
      "These guys are amazing! They tackled a massive cleanup job at my property and did it with such professionalism. Fair pricing and excellent work quality.",
  },
  {
    name: "David K.",
    review:
      "I've used several landscaping services before, but none compare to DCD Labor. Reliable, hardworking, and they truly care about customer satisfaction. Highly recommended!",
  },
];

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  // Number of testimonials to show based on screen size
  const testimonialsToShow = isDesktop ? 3 : 1;
  const totalSlides = Math.ceil(testimonials.length / testimonialsToShow);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Auto-rotate every 9 seconds (increased from 7)
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 9000);

    return () => clearInterval(interval);
  }, [totalSlides]);

  // Get testimonials for current slide
  const getCurrentTestimonials = () => {
    const startIndex = currentIndex * testimonialsToShow;
    return testimonials.slice(startIndex, startIndex + testimonialsToShow);
  };

  return (
    <section className="testimonials-section">
      <h2 className="testimonials-heading">What Our Customers Say</h2>
      
      <div className="testimonials-carousel">
        <div className="testimonials-container">
          {Array.from({ length: totalSlides }).map((_, slideIndex) => {
            const slideTestimonials = testimonials.slice(
              slideIndex * testimonialsToShow,
              slideIndex * testimonialsToShow + testimonialsToShow
            );
            
            const isActive = slideIndex === currentIndex;
            
            return (
              <div
                key={slideIndex}
                className={`testimonials-slide ${isActive ? 'active' : ''}`}
                style={{
                  display: isActive ? 'flex' : 'none',
                }}
              >
                {slideTestimonials.map((testimonial, index) => (
                  <div 
                    className="testimonial-card" 
                    key={`${slideIndex}-${index}`}
                    style={{
                      transform: isActive ? 'translateY(0)' : 'translateY(20px)',
                      opacity: isActive ? 1 : 0,
                      transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.15}s`
                    }}
                  >
                    <p className="testimonial-review">"{testimonial.review}"</p>
                    <h4 className="testimonial-name">– {testimonial.name}</h4>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        
        {/* Navigation dots */}
        <div className="testimonials-dots">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to testimonial slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
  