import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Contact from "./pages/Contact";
import OurStory from "./pages/OurStory";
import Admin from "./pages/Admin";
import Crew from "./pages/Crew";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/our-story" element={<OurStory />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/crew" element={<Crew />} />
      </Routes>
    </Router>
  );
}

export default App;
