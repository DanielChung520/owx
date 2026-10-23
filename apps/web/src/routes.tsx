import { Routes, Route } from "react-router-dom";
import { App } from "./App";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/reset" element={<ResetPassword />} />
      <Route path="/*" element={<App />} />
    </Routes>
  );
}
