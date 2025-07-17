import { useEffect, useState } from "react";
import dcd1 from "../assets/images/dcd1.jpg";
import dcd3 from "../assets/images/dcd3.jpg";
import dcd4 from "../assets/images/dcd4.jpg";

const images = [dcd1, dcd3, dcd4];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{ position: "relative", width: "100vw", paddingTop: "48%", overflow: "hidden" }}>
      {/* Slides */}
      {images.map((img, i) => {
        // Determine class based on current slide index
        let style = {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "transform 1s ease-in-out, opacity 1s ease-in-out",
          opacity: i === current ? 1 : 0,
          zIndex: i === current ? 2 : 1,
        };

        if (i === current) {
          style.transform = "translateX(0)";
        } else if (i === (current + 1) % images.length) {
          // The next image: start offscreen to the left
          style.transform = "translateX(-100%)";
        } else {
          // All others offscreen right
          style.transform = "translateX(100%)";
        }

        return <img key={i} src={img} alt={`Slide ${i}`} style={style} />;
      })}

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 3,
        }}
      />

      {/* Centered text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          textAlign: "center",
          zIndex: 4,
          padding: "0 20px",
          textShadow: "0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)", // Enhanced shadow for text pop
          maxWidth: "90vw",
        }}
      >
        <h1 style={{ 
          fontSize: "clamp(1.5rem, 4.5vw, 3.5rem)", 
          marginBottom: "0.5rem",
          lineHeight: "1.1",
          fontWeight: "800",
          letterSpacing: "-0.02em",
          textShadow: "0 6px 16px rgba(0,0,0,0.9), 0 3px 6px rgba(0,0,0,0.8)"
        }}>
          Local Student-Powered Landscaping
        </h1>
        <p style={{ 
          fontSize: "clamp(0.8rem, 2.2vw, 1.7rem)", 
          marginBottom: "1.5rem",
          fontWeight: "500",
          letterSpacing: "0.01em",
          textShadow: "0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
          lineHeight: "1.2"
        }}>
          Reliable. Affordable. We're your neighbors.
        </p>
      </div>
    </section>
  );
}
