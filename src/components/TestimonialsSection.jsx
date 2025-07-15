import "../styles/Testimonials.css";

const testimonials = [
    {
      name: "Jean Acosta",
      review:
        "I was so impressed with these young men. They exceeded my expectations. I highly recommend them. I will definitely be calling on them again and again for my future projects!",
    },
    {
      name: "Carmen Bruno",
      review:
        "Couldn't be more pleased. The team was very professional, courteous and efficient. Highly recommend this company.",
    },
    {
      name: "Lisa Nalisnik",
      review:
        "Great bunch of young men... I was an earlier customer when they first started out mowing... Happy to see their business growing! I highly recommend.",
    },
  ];
  
  export default function TestimonialsSection() {
    return (
        <section className="testimonials-section">
          <h2 className="testimonials-heading">What Our Customers Say</h2>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="testimonial-card" key={i}>
                <p className="testimonial-review">"{t.review}"</p>
                <h4 className="testimonial-name">– {t.name}</h4>
                <small className="testimonial-date">{t.date}</small>
              </div>
            ))}
          </div>
        </section>
      );
    }
  