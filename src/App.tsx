import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Equipments from "@/pages/Equipments";
import Orders from "@/pages/Orders";
import Lendings from "@/pages/Lendings";
import Returns from "@/pages/Returns";
import Settlements from "@/pages/Settlements";
import Repairs from "@/pages/Repairs";
import Users from "@/pages/Users";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Toast from "@/components/Toast";

export default function App() {
  return (
    <Router>
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/equipments"
            element={
              <ProtectedRoute allowedRoles={["customer", "clerk", "finance", "admin"]}>
                <Equipments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-reservations"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute allowedRoles={["clerk", "finance", "admin"]}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lend-confirm"
            element={
              <ProtectedRoute allowedRoles={["clerk", "finance", "admin"]}>
                <Lendings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/return-check"
            element={
              <ProtectedRoute allowedRoles={["clerk", "finance", "admin"]}>
                <Returns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settlements"
            element={
              <ProtectedRoute allowedRoles={["finance", "admin"]}>
                <Settlements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repairs"
            element={
              <ProtectedRoute allowedRoles={["clerk", "finance", "admin"]}>
                <Repairs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Users />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<div className="text-center text-xl py-20">404 - 页面不存在</div>} />
      </Routes>
    </Router>
  );
}
