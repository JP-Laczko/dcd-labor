// src/components/ui/Button.jsx
import React from "react";

export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-700 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
