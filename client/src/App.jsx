import React, { useState, useEffect } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProviderDashboard from "./pages/ProviderDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  if (currentPath === "/login") {
    return <Login onNavigate={navigate} />;
  }

  if (currentPath === "/register") {
    return <Register onNavigate={navigate} />;
  }

  if (currentPath === "/provider-dashboard") {
    return <ProviderDashboard onNavigate={navigate} />;
  }

  if (currentPath === "/customer-dashboard" || currentPath === "/dashboard") {
    return <CustomerDashboard onNavigate={navigate} />;
  }

  return <Home onNavigate={navigate} />;
}

export default App;