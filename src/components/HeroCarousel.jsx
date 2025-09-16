import { useEffect, useState } from "react";
import before3 from "../assets/images/BEFORE 3.jpg";
import before4 from "../assets/images/BEFORE 4.jpg";
import before5 from "../assets/images/BEFORE 5.jpg";
import before6 from "../assets/images/BEFORE 6.jpg";
import before7 from "../assets/images/BEFORE 7.jpg";
import before8 from "../assets/images/BEFORE 8.jpg";
import before9 from "../assets/images/BEFORE 9.jpg";
import before10 from "../assets/images/BEFORE 10.jpg";
import before11 from "../assets/images/BEFORE 11.jpg";
import before12 from "../assets/images/BEFORE 12.jpg";
import before13 from "../assets/images/BEFORE 13.jpg";
import before14 from "../assets/images/BEFORE 14.jpg";
import before15 from "../assets/images/BEFORE 15.jpg";
import before16 from "../assets/images/BEFORE 16.jpg";
import before17 from "../assets/images/BEFORE 17.jpg";
import before18 from "../assets/images/BEFORE 18.jpg";
import before19 from "../assets/images/BEFORE 19.jpg";
import before20 from "../assets/images/BEFORE 20.jpg";
import before21 from "../assets/images/BEFORE 21.jpg";
import before22 from "../assets/images/BEFORE 22.jpg";
import beforeMain from "../assets/images/BEFORE.jpg";

const images = [before3, before4, before5, before6, before7, before8, before9, before10, before11, before12, before13, before14, before15, before16, before17, before18, before19, before20, before21, before22, beforeMain];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Start first transition after 2 seconds
    const firstTimeout = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 2000);

    // Then continue with regular 5-second intervals
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => {
      clearTimeout(firstTimeout);
      clearInterval(interval);
    };
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
          Modern Labor, Old-School Work Ethic
        </h1>
        <p style={{ 
          fontSize: "clamp(0.8rem, 2.2vw, 1.7rem)", 
          marginBottom: "1.5rem",
          fontWeight: "500",
          letterSpacing: "0.01em",
          textShadow: "0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)",
          lineHeight: "1.2"
        }}>
          Affordable. Reliable. Trustworthy.
        </p>
      </div>
    </section>
  );
}
