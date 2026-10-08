import React, { useState, useEffect } from "react";
import "./CustomerDashboard.css";

function CustomerDashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'find_service' | 'bookings' | 'profile'
  const [bookingFilter, setBookingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);

  const [newBookingForm, setNewBookingForm] = useState({
    serviceTitle: "AC Repair & Servicing",
    bookingDate: "2026-10-10",
    customerAddress: "House 14, Road 5, Banani, Dhaka",
    price: 1500,
    notes: "",
    providerId: "",
  });

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    email: "",
  });

  // Fetch Customer Dashboard Data on Mount
  useEffect(() => {
    fetchCustomerData();
    fetchProvidersList();
  }, []);

  const getAuthHeader = () => {
    const token = localStorage.getItem("slsf_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchCustomerData = async () => {
    setLoading(true);
    setAlertMsg({ type: "", text: "" });

    try {
      const token = localStorage.getItem("slsf_token");
      if (!token) {
        if (onNavigate) onNavigate("/login");
        else window.location.href = "/login";
        return;
      }

      // Fetch Profile
      const profRes = await fetch("http://localhost:5000/api/customer/profile", {
        headers: getAuthHeader(),
      });
      const profData = await profRes.json();

      if (!profRes.ok) {
        throw new Error(profData.message || "Failed to load customer profile");
      }

      setUser(profData.user);
      setProfileForm({
        fullName: profData.user.fullName || "",
        phone: profData.user.phone || "",
        email: profData.user.email || "",
      });

      // Fetch Bookings
      const bookRes = await fetch("http://localhost:5000/api/customer/bookings", {
        headers: getAuthHeader(),
      });
      const bookData = await bookRes.json();

      if (bookRes.ok) {
        setBookings(bookData.bookings || []);
      }
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error loading dashboard data" });
    } finally {
      setLoading(false);
    }
  };

  const fetchProvidersList = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/providers/list");
      const data = await res.json();
      if (res.ok) {
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.log("Error fetching providers list:", err.message);
    }
  };

  // Submit New Booking
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setSubmittingBooking(true);
    setAlertMsg({ type: "", text: "" });

    try {
      const response = await fetch("http://localhost:5000/api/customer/bookings", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(newBookingForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create booking");
      }

      setBookings([data.booking, ...bookings]);
      setShowBookingModal(false);
      setActiveTab("bookings");
      setAlertMsg({ type: "success", text: "🎉 Service booking request submitted successfully!" });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 4000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error creating booking request" });
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking request?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/customer/bookings/${bookingId}/cancel`, {
        method: "PUT",
        headers: getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to cancel booking");
      }

      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, status: "cancelled" } : b))
      );
      setAlertMsg({ type: "success", text: "Booking cancelled successfully" });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error cancelling booking" });
    }
  };

  // Save Profile Changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setAlertMsg({ type: "", text: "" });

    try {
      const response = await fetch("http://localhost:5000/api/customer/profile", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({
          fullName: profileForm.fullName,
          phone: profileForm.phone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      setUser(data.user);
      localStorage.setItem("slsf_user", JSON.stringify(data.user));
      setAlertMsg({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error saving profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Open booking modal for a specific provider
  const handleOpenModalForProvider = (provider) => {
    setNewBookingForm({
      ...newBookingForm,
      serviceTitle: `${provider.serviceCategory} Service`,
      price: provider.hourlyRate || 1000,
      providerId: provider.user ? provider.user._id : "",
    });
    setShowBookingModal(true);
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("slsf_token");
    localStorage.removeItem("slsf_user");
    if (onNavigate) onNavigate("/login");
    else window.location.href = "/login";
  };

  // Stats calculation
  const totalBookings = bookings.length;
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "pending" || b.status === "accepted"
  ).length;
  const completedBookingsCount = bookings.filter((b) => b.status === "completed").length;

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === "all") return true;
    return b.status === bookingFilter;
  });

  const filteredProviders = providers.filter((p) => {
    const matchesCategory =
      categoryFilter === "All" ||
      (p.serviceCategory && p.serviceCategory.toLowerCase().includes(categoryFilter.toLowerCase()));
    const matchesSearch =
      searchQuery === "" ||
      (p.user && p.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.serviceCategory && p.serviceCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="cd-dashboard-container">
      {/* Top Navbar */}
      <header className="cd-navbar">
        <div className="cd-brand" onClick={() => onNavigate && onNavigate("/")}>
          <div className="cd-brand-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="cd-brand-title">
            Smart Local <span>Service Finder</span>
          </div>
        </div>

        <div className="cd-nav-controls">
          <div className="cd-user-profile-badge">
            <div className="cd-avatar">
              {user ? user.fullName.charAt(0).toUpperCase() : "C"}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                {user ? user.fullName : "Customer"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--cd-text-muted)" }}>
                Customer Account
              </span>
            </div>
            <button className="cd-btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="cd-main-content">
        {/* Welcome Section */}
        <div className="cd-welcome-section">
          <div className="cd-welcome-title">
            <h1>Welcome, {user ? user.fullName : "Customer"}! 👋</h1>
            <p>Find the best local services near you & manage your bookings.</p>
          </div>

          <button
            className="cd-btn-book-new"
            onClick={() => setShowBookingModal(true)}
          >
            <span>➕</span> Request New Service
          </button>
        </div>

        {/* Global Alert Message */}
        {alertMsg.text && (
          <div className={`cd-alert ${alertMsg.type}`}>
            {alertMsg.type === "error" ? "⚠️ " : "✅ "}
            {alertMsg.text}
          </div>
        )}

        {/* Stats Cards Row */}
        <div className="cd-stats-grid">
          <div className="cd-stat-card">
            <div className="cd-stat-icon blue">📋</div>
            <div className="cd-stat-info">
              <h4>Total Bookings</h4>
              <div className="cd-stat-value">{totalBookings}</div>
            </div>
          </div>

          <div className="cd-stat-card">
            <div className="cd-stat-icon yellow">⏳</div>
            <div className="cd-stat-info">
              <h4>Active Bookings</h4>
              <div className="cd-stat-value">{activeBookingsCount}</div>
            </div>
          </div>

          <div className="cd-stat-card">
            <div className="cd-stat-icon green">⭐</div>
            <div className="cd-stat-info">
              <h4>Completed Services</h4>
              <div className="cd-stat-value">{completedBookingsCount}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="cd-tabs">
          <button
            className={`cd-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Dashboard Overview
          </button>
          <button
            className={`cd-tab-btn ${activeTab === "find_service" ? "active" : ""}`}
            onClick={() => setActiveTab("find_service")}
          >
            🔍 Find Service ({providers.length})
          </button>
          <button
            className={`cd-tab-btn ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            📅 My Bookings ({bookings.length})
          </button>
          <button
            className={`cd-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 My Profile
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="cd-empty-state">
            <div className="cd-empty-state-icon">🔄</div>
            <h3>Loading dashboard data from database...</h3>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="cd-section-card">
                <div className="cd-section-header">
                  <h3>Recent Service Bookings</h3>
                  <button
                    className="cd-filter-btn"
                    onClick={() => setActiveTab("bookings")}
                  >
                    View All Bookings →
                  </button>
                </div>

                {bookings.length === 0 ? (
                  <div className="cd-empty-state">
                    <div className="cd-empty-state-icon">📭</div>
                    <h3>No service bookings found</h3>
                    <p>Click "Request New Service" above to book your first service!</p>
                  </div>
                ) : (
                  <div className="cd-bookings-list">
                    {bookings.slice(0, 4).map((booking) => (
                      <div className="cd-booking-item" key={booking._id}>
                        <div className="cd-booking-main">
                          <h4>{booking.serviceTitle}</h4>
                          <div className="cd-booking-details">
                            <div className="cd-detail-item">📍 {booking.customerAddress}</div>
                            <div className="cd-detail-item">📅 {booking.bookingDate}</div>
                            <div className="cd-detail-item" style={{ color: "#60a5fa", fontWeight: "700" }}>
                              ৳{booking.price}
                            </div>
                          </div>
                        </div>

                        <div className="cd-booking-actions">
                          <span className={`cd-booking-badge ${booking.status}`}>
                            {booking.status}
                          </span>
                          {booking.status === "pending" && (
                            <button
                              className="cd-btn-cancel-req"
                              onClick={() => handleCancelBooking(booking._id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FIND SERVICE */}
            {activeTab === "find_service" && (
              <div className="cd-section-card">
                <div className="cd-section-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                  <h3>Find Local Service Providers</h3>

                  {/* Category Filter Chips */}
                  <div className="cd-filter-group" style={{ flexWrap: "wrap" }}>
                    {["All", "Plumbing", "Electrician", "Cleaning", "AC Service", "Computer Repair", "Carpentry"].map((cat) => (
                      <button
                        key={cat}
                        className={`cd-filter-btn ${categoryFilter === cat ? "active" : ""}`}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredProviders.length === 0 ? (
                  <div className="cd-empty-state">
                    <div className="cd-empty-state-icon">🛠️</div>
                    <h3>No service providers found for this category</h3>
                    <p>Try switching categories or submit a general booking request.</p>
                  </div>
                ) : (
                  <div className="cd-providers-grid">
                    {filteredProviders.map((provider) => (
                      <div className="cd-provider-card" key={provider._id}>
                        <div className="cd-provider-header">
                          <div className="cd-provider-avatar">
                            {provider.user ? provider.user.fullName.charAt(0) : "P"}
                          </div>
                          <div className="cd-provider-name">
                            <h4>{provider.user ? provider.user.fullName : "Service Provider"}</h4>
                            <div className="cd-provider-category">{provider.serviceCategory}</div>
                          </div>
                        </div>

                        <div className="cd-provider-meta">
                          <div>📍 Location: {provider.location || "Dhaka"}</div>
                          <div>💰 Hourly Rate: ৳{provider.hourlyRate || 500}/hr</div>
                          <div>⭐ Rating: {provider.rating || 4.8} / 5.0</div>
                          <div>💼 Experience: {provider.experienceYears || 2} Years</div>
                        </div>

                        <button
                          className="cd-btn-request-service"
                          onClick={() => handleOpenModalForProvider(provider)}
                        >
                          Request Booking
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MY BOOKINGS */}
            {activeTab === "bookings" && (
              <div className="cd-section-card">
                <div className="cd-section-header">
                  <h3>All Service Bookings</h3>
                  <div className="cd-filter-group">
                    {["all", "pending", "accepted", "completed", "cancelled"].map((filter) => (
                      <button
                        key={filter}
                        className={`cd-filter-btn ${bookingFilter === filter ? "active" : ""}`}
                        onClick={() => setBookingFilter(filter)}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="cd-empty-state">
                    <div className="cd-empty-state-icon">🔍</div>
                    <h3>No {bookingFilter !== "all" ? bookingFilter : ""} bookings found</h3>
                  </div>
                ) : (
                  <div className="cd-bookings-list">
                    {filteredBookings.map((booking) => (
                      <div className="cd-booking-item" key={booking._id}>
                        <div className="cd-booking-main">
                          <h4>{booking.serviceTitle}</h4>
                          <div className="cd-booking-details" style={{ marginBottom: "8px" }}>
                            <div className="cd-detail-item">👤 {booking.customerName} ({booking.customerPhone})</div>
                            <div className="cd-detail-item">📍 {booking.customerAddress}</div>
                            <div className="cd-detail-item">📅 {booking.bookingDate}</div>
                            <div className="cd-detail-item" style={{ color: "#60a5fa", fontWeight: "700" }}>
                              Price: ৳{booking.price}
                            </div>
                          </div>
                          {booking.notes && (
                            <p style={{ fontSize: "0.88rem", color: "#94a3b8", fontStyle: "italic" }}>
                              Notes: "{booking.notes}"
                            </p>
                          )}
                        </div>

                        <div className="cd-booking-actions">
                          <span className={`cd-booking-badge ${booking.status}`}>
                            {booking.status}
                          </span>
                          {booking.status === "pending" && (
                            <button
                              className="cd-btn-cancel-req"
                              onClick={() => handleCancelBooking(booking._id)}
                            >
                              Cancel Booking
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MY PROFILE */}
            {activeTab === "profile" && (
              <div className="cd-section-card">
                <div className="cd-section-header">
                  <h3>Edit Personal Profile</h3>
                </div>

                <form onSubmit={handleSaveProfile} className="cd-form-grid">
                  <div className="cd-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="cd-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="cd-form-group full-width">
                    <label>Email Address (Read-only)</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      style={{ opacity: 0.6, cursor: "not-allowed" }}
                    />
                  </div>

                  <div className="cd-form-group full-width" style={{ marginTop: "10px" }}>
                    <button type="submit" className="cd-btn-submit-booking" disabled={savingProfile}>
                      {savingProfile ? "Saving Profile..." : "💾 Save Profile Changes"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* NEW BOOKING MODAL */}
      {showBookingModal && (
        <div className="cd-modal-overlay">
          <div className="cd-modal">
            <div className="cd-modal-header">
              <h3>Book a Local Service</h3>
              <button className="cd-btn-close" onClick={() => setShowBookingModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="cd-form-grid">
              <div className="cd-form-group full-width">
                <label>Service Type / Title</label>
                <select
                  value={newBookingForm.serviceTitle}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, serviceTitle: e.target.value })}
                  required
                >
                  <option value="AC Repair & Servicing">❄️ AC Repair & Servicing</option>
                  <option value="Plumbing Leak Fix">🔧 Plumbing & Pipe Repair</option>
                  <option value="Home Deep Cleaning">🧹 Home Deep Cleaning</option>
                  <option value="Electrical Wiring Repair">⚡ Electrical Repair</option>
                  <option value="Appliance Maintenance">📺 TV & Home Appliance Maintenance</option>
                  <option value="House Wall Painting">🎨 House Wall Painting</option>
                  <option value="Carpentry Service">🪵 Carpentry & Wood Repair</option>
                </select>
              </div>

              <div className="cd-form-group">
                <label>Preferred Date</label>
                <input
                  type="text"
                  placeholder="e.g. 25 Sep 2026 or Tomorrow 10am"
                  value={newBookingForm.bookingDate}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, bookingDate: e.target.value })}
                  required
                />
              </div>

              <div className="cd-form-group">
                <label>Estimated Price (৳ BDT)</label>
                <input
                  type="number"
                  value={newBookingForm.price}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, price: e.target.value })}
                  required
                />
              </div>

              <div className="cd-form-group full-width">
                <label>Service Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. House 14, Road 5, Banani, Dhaka"
                  value={newBookingForm.customerAddress}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, customerAddress: e.target.value })}
                  required
                />
              </div>

              <div className="cd-form-group full-width">
                <label>Special Instructions / Notes</label>
                <textarea
                  rows="3"
                  placeholder="Explain your problem or special request..."
                  value={newBookingForm.notes}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="cd-form-group full-width">
                <button type="submit" className="cd-btn-submit-booking" disabled={submittingBooking}>
                  {submittingBooking ? "Submitting Request..." : "🚀 Confirm & Request Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDashboard;
