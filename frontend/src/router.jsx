import { Routes, Route } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import RequireOwner from "./auth/RequireOwner.jsx";

// Public pages
import HomePage from "./pages/home.jsx";
import SearchPage from "./pages/search.jsx";
import LoginPage from "./pages/login.jsx";
import RegisterPage from "./pages/register.jsx";
import RequestResetPage from "./pages/request-password-reset.jsx";
import ResetPasswordPage from "./pages/reset-password.jsx";
import OAuthCallbackPage from "./pages/oauth-callback.jsx";
import VerifiedPage from "./pages/verified.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import BookingThankYou from "./pages/BookingThankYou.jsx";
import LinkEmailPage from "./pages/link-email.jsx";
import MapExplore from "./pages/MapExplore.jsx";
import AboutPage from "./pages/about.jsx";
import MyReservationsPage from "./pages/MyReservations.jsx";

// Private pages
import DashboardPage from "./pages/dashboard.jsx";
import OnboardingPage from "./pages/onboarding.jsx";
import OwnerReservationsPage from "./pages/OwnerReservationsPage.jsx";

export default function AppRouter() {
  return (
    <Routes>
      {/* JAVNE ROUTE */}
      <Route element={<PublicLayout />}>        
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
  <Route path="/book/:propertyId" element={<BookingPage />} />
  <Route path="/book/:propertyId/:unitId" element={<BookingPage />} />
        <Route path="/booking/thank-you/:code" element={<BookingThankYou />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/request-password-reset" element={<RequestResetPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/verified" element={<VerifiedPage />} />
        <Route path="/link-email" element={<LinkEmailPage />} />
        <Route path="/map" element={<MapExplore />} />
  <Route path="/about" element={<AboutPage />} />
  <Route path="/reservations" element={<MyReservationsPage />} />
      </Route>

  {/* PRIVATNE (dashboard) */}
  <Route element={<RequireOwner><DashboardLayout /></RequireOwner>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
  <Route path="/dashboard/reservations" element={<OwnerReservationsPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<div className="not-found" id="not-found"><h1>404</h1></div>} />
    </Routes>
  );
}
