import React, { useState, useEffect } from "react";
import "./AdminDashboard.css";

function AdminDashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'providers' | 'users' | 'bookings'
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalProviders: 0,
    totalBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    pendingVerifications: 0,
    totalRevenue: 0,
  });

  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [adminUser, setAdminUser] = useState(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem("slsf_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setAlertMsg({ type: "", text: "" });

    try {
      const headers = getAuthHeader();

      // Fetch stats, users, providers, and bookings concurrently
      const [resStats, resUsers, resProviders, resBookings] = await Promise.all([
        fetch("http://localhost:5000/api/admin/stats", { headers }),
        fetch("http://localhost:5000/api/admin/users", { headers }),
        fetch("http://localhost:5000/api/admin/providers", { headers }),
        fetch("http://localhost:5000/api/admin/bookings", { headers }),
      ]);

      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }

      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsers(dataUsers.users || []);
      }

      if (resProviders.ok) {
        const dataProviders = await resProviders.json();
        setProviders(dataProviders.providers || []);
      }

      if (resBookings.ok) {
        const dataBookings = await resBookings.json();
        setBookings(dataBookings.bookings || []);
      }
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Failed to load admin data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is logged in as admin
    const storedUser = localStorage.getItem("slsf_user");
    const token = localStorage.getItem("slsf_token");

    if (!token || !storedUser) {
      if (onNavigate) onNavigate("/login");
      else window.location.href = "/login";
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      if (parsed.role !== "admin") {
        alert("Access Denied: Administrator account required.");
        if (onNavigate) onNavigate("/login");
        else window.location.href = "/login";
        return;
      }
      setAdminUser(parsed);
    } catch {
      if (onNavigate) onNavigate("/login");
      return;
    }

    fetchAdminData();
  }, []);

  // 1. Verify or Reject Provider
  const handleVerifyProvider = async (profileId, status) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/providers/${profileId}/verify`, {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update verification status");

      setProviders((prev) =>
        prev.map((p) => (p._id === profileId ? { ...p, verificationStatus: status } : p))
      );
      setStats((prev) => ({
        ...prev,
        pendingVerifications: status === "pending" ? prev.pendingVerifications + 1 : Math.max(0, prev.pendingVerifications - 1),
      }));

      setAlertMsg({ type: "success", text: `Provider has been successfully marked as ${status.toUpperCase()}!` });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message });
    }
  };

  // 2. Block / Unblock User Account
  const handleToggleBlockUser = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/toggle-block`, {
        method: "PUT",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update user account status");

      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isBlocked: !u.isBlocked } : u))
      );

      setAlertMsg({ type: "success", text: data.message });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message });
    }
  };

  // 3. Delete User
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user permanently?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");

      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setProviders((prev) => prev.filter((p) => p.user?._id !== userId));
      setAlertMsg({ type: "success", text: "User removed successfully" });
      setTimeout(() => setAlertMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message });
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("slsf_token");
    localStorage.removeItem("slsf_user");
    if (onNavigate) onNavigate("/login");
    else window.location.href = "/login";
  };

  return (
    <div className="ad-container">
      {/* Top Navbar */}
      <header className="ad-navbar">
        <div className="ad-brand" onClick={() => onNavigate && onNavigate("/")}>
          <div className="ad-brand-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="ad-brand-title">
            Smart Local <span>Service Finder</span>
            <span className="ad-badge-admin">Admin Portal</span>
          </div>
        </div>

        <div className="ad-nav-controls">
          <div className="ad-user-profile">
            <div className="ad-avatar">A</div>
            <div>
              <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>
                {adminUser?.fullName || "System Admin"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--ad-text-muted)" }}>
                Administrator
              </div>
            </div>
          </div>
          <button className="ad-btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="ad-main">
        {/* Banner */}
        <div className="ad-header-banner">
          <div>
            <h1>Admin Control Panel 🛡️</h1>
            <p>Manage users, verify service providers, and monitor platform operations.</p>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alertMsg.text && (
          <div className={`ad-alert ${alertMsg.type}`}>
            {alertMsg.type === "error" ? "⚠️ " : "✅ "}
            {alertMsg.text}
          </div>
        )}

        {/* Stats Grid Overview */}
        <div className="ad-stats-grid">
          <div className="ad-stat-card">
            <div className="ad-stat-icon blue">👥</div>
            <div className="ad-stat-info">
              <h4>Total Users</h4>
              <div className="ad-stat-value">{stats.totalUsers}</div>
            </div>
          </div>

          <div className="ad-stat-card">
            <div className="ad-stat-icon purple">🛠️</div>
            <div className="ad-stat-info">
              <h4>Total Providers</h4>
              <div className="ad-stat-value">{stats.totalProviders}</div>
            </div>
          </div>

          <div className="ad-stat-card">
            <div className="ad-stat-icon yellow">⏳</div>
            <div className="ad-stat-info">
              <h4>Pending Verifications</h4>
              <div className="ad-stat-value">{stats.pendingVerifications}</div>
            </div>
          </div>

          <div className="ad-stat-card">
            <div className="ad-stat-icon green">💰</div>
            <div className="ad-stat-info">
              <h4>Platform Revenue</h4>
              <div className="ad-stat-value">৳{stats.totalRevenue.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="ad-tabs">
          <button
            className={`ad-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 System Overview
          </button>
          <button
            className={`ad-tab-btn ${activeTab === "providers" ? "active" : ""}`}
            onClick={() => setActiveTab("providers")}
          >
            🛡️ Provider Verification ({providers.length})
          </button>
          <button
            className={`ad-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 User Management ({users.length})
          </button>
          <button
            className={`ad-tab-btn ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            📋 All Platform Bookings ({bookings.length})
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="ad-empty-state">
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🔄</div>
            <h3>Loading administrator dashboard data...</h3>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="ad-section-card">
                <div className="ad-section-header">
                  <h3>Recent Platform Bookings</h3>
                  <button className="ad-tab-btn active" onClick={() => setActiveTab("bookings")}>
                    View All →
                  </button>
                </div>

                {bookings.length === 0 ? (
                  <div className="ad-empty-state">
                    <h3>No bookings recorded yet on the platform</h3>
                  </div>
                ) : (
                  <div className="ad-table-container">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Customer</th>
                          <th>Service Date</th>
                          <th>Price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.slice(0, 5).map((b) => (
                          <tr key={b._id}>
                            <td><strong>{b.serviceTitle}</strong></td>
                            <td>{b.customerName} ({b.customerPhone})</td>
                            <td>{b.bookingDate}</td>
                            <td style={{ color: "#34d399", fontWeight: "700" }}>৳{b.price}</td>
                            <td>
                              <span className={`ad-badge ${b.status}`}>{b.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PROVIDER VERIFICATION */}
            {activeTab === "providers" && (
              <div className="ad-section-card">
                <div className="ad-section-header">
                  <div>
                    <h3>Service Provider Verification & Approval</h3>
                    <p style={{ margin: "4px 0 0 0", color: "var(--ad-text-muted)", fontSize: "0.85rem" }}>
                      Review provider documents/experience and approve or reject their listing on the platform.
                    </p>
                  </div>
                </div>

                {providers.length === 0 ? (
                  <div className="ad-empty-state">
                    <h3>No service providers registered yet</h3>
                  </div>
                ) : (
                  <div className="ad-table-container">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Provider Name</th>
                          <th>Category</th>
                          <th>Location</th>
                          <th>Hourly Rate</th>
                          <th>Experience</th>
                          <th>Verification Status</th>
                          <th>Admin Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {providers.map((p) => (
                          <tr key={p._id}>
                            <td>
                              <strong>{p.user?.fullName || "Provider"}</strong>
                              <div style={{ fontSize: "0.78rem", color: "var(--ad-text-muted)" }}>
                                {p.user?.email || "No email"} | {p.user?.phone || "No phone"}
                              </div>
                            </td>
                            <td>{p.serviceCategory}</td>
                            <td>{p.location}</td>
                            <td>৳{p.hourlyRate}/hr</td>
                            <td>{p.experienceYears} Years</td>
                            <td>
                              <span className={`ad-badge ${p.verificationStatus || "pending"}`}>
                                {p.verificationStatus || "pending"}
                              </span>
                            </td>
                            <td>
                              {p.verificationStatus !== "verified" && (
                                <button
                                  className="ad-btn-action ad-btn-approve"
                                  onClick={() => handleVerifyProvider(p._id, "verified")}
                                  title="Approve this provider to take jobs"
                                >
                                  ✓ Approve
                                </button>
                              )}
                              {p.verificationStatus !== "rejected" && (
                                <button
                                  className="ad-btn-action ad-btn-reject"
                                  onClick={() => handleVerifyProvider(p._id, "rejected")}
                                  title="Reject this provider"
                                >
                                  ✕ Reject
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: USER & ACCOUNT MANAGEMENT */}
            {activeTab === "users" && (
              <div className="ad-section-card">
                <div className="ad-section-header">
                  <div>
                    <h3>User & Account Management</h3>
                    <p style={{ margin: "4px 0 0 0", color: "var(--ad-text-muted)", fontSize: "0.85rem" }}>
                      Monitor registered users, suspend violators, or remove spam accounts.
                    </p>
                  </div>
                </div>

                <div className="ad-table-container">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Account Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id}>
                          <td><strong>{u.fullName}</strong></td>
                          <td>{u.email}</td>
                          <td>{u.phone}</td>
                          <td>
                            <span className={`ad-badge ${u.role}`}>{u.role}</span>
                          </td>
                          <td>
                            <span className={`ad-badge ${u.isBlocked ? "blocked" : "active"}`}>
                              {u.isBlocked ? "Suspended / Blocked" : "Active"}
                            </span>
                          </td>
                          <td>
                            {u.role !== "admin" && (
                              <>
                                <button
                                  className={`ad-btn-action ${u.isBlocked ? "ad-btn-unblock" : "ad-btn-block"}`}
                                  onClick={() => handleToggleBlockUser(u._id)}
                                >
                                  {u.isBlocked ? "Unblock" : "Block"}
                                </button>
                                <button
                                  className="ad-btn-action ad-btn-delete"
                                  onClick={() => handleDeleteUser(u._id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {u.role === "admin" && (
                              <span style={{ fontSize: "0.8rem", color: "var(--ad-text-muted)" }}>
                                Protected Admin
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: ALL BOOKINGS */}
            {activeTab === "bookings" && (
              <div className="ad-section-card">
                <div className="ad-section-header">
                  <h3>All Platform Bookings</h3>
                </div>

                {bookings.length === 0 ? (
                  <div className="ad-empty-state">
                    <h3>No bookings found</h3>
                  </div>
                ) : (
                  <div className="ad-table-container">
                    <table className="ad-table">
                      <thead>
                        <tr>
                          <th>Service Title</th>
                          <th>Customer</th>
                          <th>Address</th>
                          <th>Date</th>
                          <th>Price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => (
                          <tr key={b._id}>
                            <td><strong>{b.serviceTitle}</strong></td>
                            <td>{b.customerName} ({b.customerPhone})</td>
                            <td>{b.customerAddress}</td>
                            <td>{b.bookingDate}</td>
                            <td style={{ color: "#34d399", fontWeight: "700" }}>৳{b.price}</td>
                            <td>
                              <span className={`ad-badge ${b.status}`}>{b.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
