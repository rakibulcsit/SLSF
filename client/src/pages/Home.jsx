import React, { useState, useEffect } from "react";
import "./Home.css";

function Home({ onNavigate }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("slsf_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("slsf_token");
    localStorage.removeItem("slsf_user");
    setUser(null);
  };

  const handleNav = (e, path) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div className="home">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo" onClick={(e) => handleNav(e, "/")} style={{ cursor: "pointer" }}>
          Smart<span>Finder</span>
        </div>

        <div className="nav-links">
          <a href="/" onClick={(e) => handleNav(e, "/")}>
            Home
          </a>
          <a href="#services">Services</a>
          <a href="#how">How It Works</a>
          {user ? (
            <div className="user-badge-group" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "white", fontSize: "0.9rem" }}>
                👤 {user.fullName} ({user.role})
              </span>
              <a
                href={user.role === "provider" ? "/provider-dashboard" : "/customer-dashboard"}
                onClick={(e) =>
                  handleNav(
                    e,
                    user.role === "provider" ? "/provider-dashboard" : "/customer-dashboard"
                  )
                }
                style={{
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
              >
                📊 Dashboard
              </a>
              <button
                onClick={handleLogout}
                style={{
                  background: "#e74c3c",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                }}
              >
                Logout
              </button>
            </div>

          ) : (
            <>
              <a href="/login" onClick={(e) => handleNav(e, "/login")}>
                Login
              </a>
              <a
                href="/register"
                className="register-btn"
                onClick={(e) => handleNav(e, "/register")}
              >
                Register
              </a>
            </>
          )}
        </div>
      </nav>


      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>
            Find Trusted Local
            <span> Services Near You</span>
          </h1>

          <p>
            Find reliable service providers near your location, compare prices
            and ratings, and book the service you need.
          </p>

          <div className="search-box">
            <input type="text" placeholder="What service do you need?" />

            <input type="text" placeholder="Enter your location" />

            <button>Search</button>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="services" id="services">
        <h2>Popular Services</h2>

        <p className="section-text">
          Find the right professional for your needs
        </p>

        <div className="service-container">
          <div className="service-card">
            <div className="icon">🔧</div>
            <h3>Plumber</h3>
            <p>Find trusted plumbing services.</p>
          </div>

          <div className="service-card">
            <div className="icon">⚡</div>
            <h3>Electrician</h3>
            <p>Get reliable electrical services.</p>
          </div>

          <div className="service-card">
            <div className="icon">🧹</div>
            <h3>Cleaning</h3>
            <p>Book professional cleaning services.</p>
          </div>

          <div className="service-card">
            <div className="icon">💻</div>
            <h3>Computer Repair</h3>
            <p>Find computer repair experts.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how" id="how">
        <h2>How It Works</h2>

        <div className="steps">
          <div className="step">
            <div>1</div>
            <h3>Search</h3>
            <p>Search for the service you need.</p>
          </div>

          <div className="step">
            <div>2</div>
            <h3>Compare</h3>
            <p>Compare providers, prices and ratings.</p>
          </div>

          <div className="step">
            <div>3</div>
            <h3>Book</h3>
            <p>Choose a provider and request service.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;