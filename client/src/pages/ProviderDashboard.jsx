import React, { useState, useEffect } from "react";
import "./ProviderDashboard.css";

function ProviderDashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'bookings' | 'profile'
  const [bookingFilter, setBookingFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    serviceCategory: "Plumbing",
    bio: "",
    hourlyRate: 500,
    location: "Dhaka, Bangladesh",
    experienceYears: 3,
    isAvailable: true,
    rating: 4.8,
    completedJobsCount: 0,
  });

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    serviceCategory: "Plumbing",
    hourlyRate: 500,
    location: "Dhaka, Bangladesh",
    experienceYears: 3,
    bio: "",
  });

  const [bookings, setBookings] = useState([]);

  // Fetch Provider Profile & Bookings on Mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getAuthHeader = () => {
    const token = localStorage.getItem("slsf_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchDashboardData = async () => {
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
      const profRes = await fetch("http://localhost:5000/api/provider/profile", {
        headers: getAuthHeader(),
      });
      const profData = await profRes.json();

      if (!profRes.ok) {
        throw new Error(profData.message || "Failed to load provider profile");
      }

      setUser(profData.user);
      setProfile(profData.profile);
      setFormData({
        fullName: profData.user.fullName || "",
        phone: profData.user.phone || "",
        serviceCategory: profData.profile.serviceCategory || "Plumbing",
        hourlyRate: profData.profile.hourlyRate || 500,
        location: profData.profile.location || "Dhaka, Bangladesh",
        experienceYears: profData.profile.experienceYears || 3,
        bio: profData.profile.bio || "",
      });

      // Fetch Bookings
      const bookRes = await fetch("http://localhost:5000/api/provider/bookings", {
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

  // Toggle Availability Status (Available / Busy)
  const handleToggleAvailability = async () => {
    const newStatus = !profile.isAvailable;
    setProfile({ ...profile, isAvailable: newStatus });

    try {
      const response = await fetch("http://localhost:5000/api/provider/profile", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({ isAvailable: newStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message);
      }
      setAlertMsg({
        type: "success",
        text: `Status updated to ${newStatus ? "Available for Jobs" : "Busy"}`,
      });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setProfile({ ...profile, isAvailable: !newStatus });
      setAlertMsg({ type: "error", text: err.message || "Failed to update availability" });
    }
  };

  // Update Booking Status (Accept / Complete / Cancel)
  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/provider/bookings/${bookingId}`, {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update status");
      }

      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, status: newStatus } : b))
      );

      // If completed, refresh profile stats
      if (newStatus === "completed") {
        setProfile((prev) => ({
          ...prev,
          completedJobsCount: prev.completedJobsCount + 1,
        }));
      }

      setAlertMsg({
        type: "success",
        text: `Booking marked as ${newStatus.toUpperCase()}`,
      });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error updating booking status" });
    }
  };

  // Save Profile Changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setAlertMsg({ type: "", text: "" });

    try {
      const response = await fetch("http://localhost:5000/api/provider/profile", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      setUser(data.user);
      setProfile(data.profile);
      localStorage.setItem("slsf_user", JSON.stringify(data.user));

      setAlertMsg({ type: "success", text: "Profile & Business info updated successfully!" });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Error saving profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("slsf_token");
    localStorage.removeItem("slsf_user");
    if (onNavigate) onNavigate("/login");
    else window.location.href = "/login";
  };

  // Calculate Stat Summaries
  const totalEarnings = bookings
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const activeBookingsCount = bookings.filter(
    (b) => b.status === "pending" || b.status === "accepted"
  ).length;

  const completedJobsCount = bookings.filter((b) => b.status === "completed").length;

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === "all") return true;
    return b.status === bookingFilter;
  });

  return (
    <div className="pd-dashboard-container">
      {/* Top Navbar */}
      <header className="pd-navbar">
        <div className="pd-brand" onClick={() => onNavigate && onNavigate("/")}>
          <div className="pd-brand-icon">
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
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div className="pd-brand-title">
            Provider<span>Portal</span>
          </div>
        </div>

        <div className="pd-nav-controls">
          {/* Availability Toggle */}
          <div className="pd-status-toggle">
            <span
              className={`pd-status-dot ${profile.isAvailable ? "available" : "busy"}`}
            ></span>
            <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>
              {profile.isAvailable ? "Available for Jobs" : "Busy / Offline"}
            </span>
            <label className="pd-switch">
              <input
                type="checkbox"
                checked={profile.isAvailable}
                onChange={handleToggleAvailability}
              />
              <span className="pd-slider"></span>
            </label>
          </div>

          {/* User Badge & Logout */}
          <div className="pd-user-profile-badge">
            <div className="pd-avatar">
              {user ? user.fullName.charAt(0).toUpperCase() : "P"}
            </div>
            <div className="pd-user-text" style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                {user ? user.fullName : "Provider"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--pd-text-muted)" }}>
                {profile.serviceCategory}
              </span>
            </div>
            <button className="pd-btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="pd-main-content">
        {/* Welcome Section */}
        <div className="pd-welcome-section">
          <div className="pd-welcome-title">
            <h1>Welcome back, {user ? user.fullName : "Provider"}! 👋</h1>
            <p>Manage your service requests, profile, and track your earnings.</p>
          </div>

          <button
            className="pd-tab-btn active"
            onClick={() => setActiveTab("bookings")}
            style={{ padding: "12px 24px" }}
          >
            📋 Manage Service Requests ({activeBookingsCount} Active)
          </button>
        </div>

        {/* Global Feedback Alert */}
        {alertMsg.text && (
          <div className={`pd-alert ${alertMsg.type}`}>
            {alertMsg.type === "error" ? "⚠️ " : "✅ "}
            {alertMsg.text}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="pd-tabs">
          <button
            className={`pd-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Dashboard Overview
          </button>
          <button
            className={`pd-tab-btn ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            📦 Booking Requests ({bookings.length})
          </button>
          <button
            className={`pd-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            ⚙️ Profile & Service Info
          </button>
        </div>

        {/* Stats Cards Row */}
        <div className="pd-stats-grid">
          <div className="pd-stat-card">
            <div className="pd-stat-icon green">৳</div>
            <div className="pd-stat-info">
              <h4>Total Earnings</h4>
              <div className="pd-stat-value">৳{totalEarnings.toLocaleString()}</div>
            </div>
          </div>

          <div className="pd-stat-card">
            <div className="pd-stat-icon yellow">⏳</div>
            <div className="pd-stat-info">
              <h4>Active Requests</h4>
              <div className="pd-stat-value">{activeBookingsCount}</div>
            </div>
          </div>

          <div className="pd-stat-card">
            <div className="pd-stat-icon blue">✅</div>
            <div className="pd-stat-info">
              <h4>Jobs Completed</h4>
              <div className="pd-stat-value">{completedJobsCount}</div>
            </div>
          </div>

          <div className="pd-stat-card">
            <div className="pd-stat-icon purple">⭐</div>
            <div className="pd-stat-info">
              <h4>Rating</h4>
              <div className="pd-stat-value">{profile.rating} / 5.0</div>
            </div>
          </div>
        </div>

        {/* Loading Spinner State */}
        {loading ? (
          <div className="pd-empty-state">
            <div className="pd-empty-state-icon">🔄</div>
            <h3>Loading dashboard data from database...</h3>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="pd-section-card">
                <div className="pd-section-header">
                  <h3>Recent Customer Requests</h3>
                  <button
                    className="pd-filter-btn"
                    onClick={() => setActiveTab("bookings")}
                  >
                    View All ({bookings.length}) →
                  </button>
                </div>

                {bookings.length === 0 ? (
                  <div className="pd-empty-state">
                    <div className="pd-empty-state-icon">📭</div>
                    <h3>No booking requests yet</h3>
                    <p>When customers request your service, they will appear here.</p>
                  </div>
                ) : (
                  <div className="pd-bookings-list">
                    {bookings.slice(0, 3).map((booking) => (
                      <div className="pd-booking-item" key={booking._id}>
                        <div className="pd-booking-main">
                          <h4>{booking.serviceTitle}</h4>
                          <div className="pd-booking-details">
                            <div className="pd-detail-item">
                              👤 <strong>{booking.customerName}</strong> ({booking.customerPhone})
                            </div>
                            <div className="pd-detail-item">📍 {booking.customerAddress}</div>
                            <div className="pd-detail-item">📅 {booking.bookingDate}</div>
                            <div className="pd-detail-item" style={{ color: "#34d399", fontWeight: "700" }}>
                              ৳{booking.price}
                            </div>
                          </div>
                        </div>

                        <div className="pd-booking-actions">
                          <span className={`pd-booking-badge ${booking.status}`}>
                            {booking.status}
                          </span>

                          {booking.status === "pending" && (
                            <button
                              className="pd-btn-action pd-btn-accept"
                              onClick={() => handleUpdateBookingStatus(booking._id, "accepted")}
                            >
                              Accept Job
                            </button>
                          )}

                          {booking.status === "accepted" && (
                            <button
                              className="pd-btn-action pd-btn-complete"
                              onClick={() => handleUpdateBookingStatus(booking._id, "completed")}
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BOOKING REQUESTS */}
            {activeTab === "bookings" && (
              <div className="pd-section-card">
                <div className="pd-section-header">
                  <h3>Customer Booking Requests</h3>
                  <div className="pd-filter-group">
                    {["all", "pending", "accepted", "completed", "cancelled"].map((filter) => (
                      <button
                        key={filter}
                        className={`pd-filter-btn ${bookingFilter === filter ? "active" : ""}`}
                        onClick={() => setBookingFilter(filter)}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="pd-empty-state">
                    <div className="pd-empty-state-icon">🔍</div>
                    <h3>No {bookingFilter !== "all" ? bookingFilter : ""} requests found</h3>
                  </div>
                ) : (
                  <div className="pd-bookings-list">
                    {filteredBookings.map((booking) => (
                      <div className="pd-booking-item" key={booking._id}>
                        <div className="pd-booking-main">
                          <h4>{booking.serviceTitle}</h4>
                          <div className="pd-booking-details" style={{ marginBottom: "8px" }}>
                            <div className="pd-detail-item">
                              👤 <strong>{booking.customerName}</strong> ({booking.customerPhone})
                            </div>
                            <div className="pd-detail-item">📍 {booking.customerAddress}</div>
                            <div className="pd-detail-item">📅 {booking.bookingDate}</div>
                            <div className="pd-detail-item" style={{ color: "#34d399", fontWeight: "700" }}>
                              Price: ৳{booking.price}
                            </div>
                          </div>
                          {booking.notes && (
                            <p style={{ fontSize: "0.88rem", color: "#94a3b8", fontStyle: "italic" }}>
                              Note: "{booking.notes}"
                            </p>
                          )}
                        </div>

                        <div className="pd-booking-actions">
                          <span className={`pd-booking-badge ${booking.status}`}>
                            {booking.status}
                          </span>

                          {booking.status === "pending" && (
                            <>
                              <button
                                className="pd-btn-action pd-btn-accept"
                                onClick={() => handleUpdateBookingStatus(booking._id, "accepted")}
                              >
                                Accept
                              </button>
                              <button
                                className="pd-btn-action pd-btn-cancel"
                                onClick={() => handleUpdateBookingStatus(booking._id, "cancelled")}
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {booking.status === "accepted" && (
                            <>
                              <button
                                className="pd-btn-action pd-btn-complete"
                                onClick={() => handleUpdateBookingStatus(booking._id, "completed")}
                              >
                                Complete
                              </button>
                              <button
                                className="pd-btn-action pd-btn-cancel"
                                onClick={() => handleUpdateBookingStatus(booking._id, "cancelled")}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PROFILE & BUSINESS INFO */}
            {activeTab === "profile" && (
              <div className="pd-section-card">
                <div className="pd-section-header">
                  <h3>Edit Provider Profile & Service Pricing</h3>
                </div>

                <form onSubmit={handleSaveProfile} className="pd-form-grid">
                  <div className="pd-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pd-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pd-form-group">
                    <label>Primary Service Category</label>
                    <select
                      value={formData.serviceCategory}
                      onChange={(e) => setFormData({ ...formData, serviceCategory: e.target.value })}
                    >
                      <option value="Plumbing">🔧 Plumbing</option>
                      <option value="Electrician">⚡ Electrician</option>
                      <option value="Cleaning">🧹 Professional Cleaning</option>
                      <option value="Computer Repair">💻 Computer & IT Repair</option>
                      <option value="AC Service">❄️ AC Service & Maintenance</option>
                      <option value="Carpentry">🪵 Carpentry & Woodwork</option>
                    </select>
                  </div>

                  <div className="pd-form-group">
                    <label>Hourly Rate / Service Fee (৳ BDT)</label>
                    <input
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pd-form-group">
                    <label>Location / Work Area</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pd-form-group">
                    <label>Experience (Years)</label>
                    <input
                      type="number"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pd-form-group full-width">
                    <label>About / Bio & Work Description</label>
                    <textarea
                      rows="4"
                      placeholder="Describe your skills, tools, and background..."
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="pd-form-group full-width" style={{ marginTop: "10px" }}>
                    <button type="submit" className="pd-btn-save" disabled={savingProfile}>
                      {savingProfile ? "Saving to Database..." : "💾 Save Profile Changes"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ProviderDashboard;
