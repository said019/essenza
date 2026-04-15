import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

// Public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CancellationPolicy from "./pages/CancellationPolicy";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

// Instructor auth pages
import InstructorAccess from "./pages/instructor/InstructorAccess";
import InstructorMagicLogin from "./pages/instructor/InstructorMagicLogin";

// Client pages
import ClientDashboard from "./pages/client/Dashboard";
import BookClasses from "./pages/client/BookClasses";
import BookClassConfirm from "./pages/client/BookClassConfirm";
import MyBookings from "./pages/client/MyBookings";
import ClassBookingDetail from "./pages/client/ClassBookingDetail";
import WalletClub from "./pages/client/Wallet";
import WalletRewards from "./pages/client/WalletRewards";
import WalletHistory from "./pages/client/WalletHistory";
import ClientProfile from "./pages/client/Profile";
import ProfileEdit from "./pages/client/ProfileEdit";
import ProfileMembership from "./pages/client/ProfileMembership";
import ProfilePreferences from "./pages/client/ProfilePreferences";
import ReferFriends from "./pages/client/ReferFriends";
import Notifications from "./pages/client/Notifications";
import News from "./pages/client/News";
import ClientCheckout from "./pages/client/Checkout";
import ClientOrders from "./pages/client/Orders";
import ClientOrderDetail from "./pages/client/OrderDetail";
import VideoLibrary from "./pages/client/VideoLibrary";
import VideoPlayer from "./pages/client/VideoPlayer";
import ClientEvents from "./pages/client/Events";
import Checkout from "./pages/Checkout";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import PlansList from "./pages/admin/plans/PlansList";
import ClientsList from "./pages/admin/clients/ClientsList";
import ClientDetail from "./pages/admin/clients/ClientDetail";
import PendingMemberships from "./pages/admin/memberships/PendingMemberships";
import MembershipsActive from "./pages/admin/memberships/MembershipsActive";
import MembershipsExpiring from "./pages/admin/memberships/MembershipsExpiring";
import MembershipsAll from "./pages/admin/memberships/MembershipsAll";
import InstructorsList from "./pages/admin/staff/InstructorsList";
import ClassTypesList from "./pages/admin/classes/ClassTypesList";
import WeeklySchedule from "./pages/admin/schedules/WeeklySchedule";
import ClassesCalendar from "./pages/admin/classes/ClassesCalendar";
import GenerateClasses from "./pages/admin/classes/GenerateClasses";
import WorkoutTemplates from "./pages/admin/classes/WorkoutTemplates";
import BookingsList from "./pages/admin/bookings/BookingsList";
import Waitlist from "./pages/admin/bookings/Waitlist";
import PartnerCheckins from "./pages/admin/bookings/PartnerCheckins";
import MemberNew from "./pages/admin/members/MemberNew";
import AssignMembership from "./pages/admin/members/AssignMembership";
import PhysicalSale from "./pages/admin/members/PhysicalSale";
import PaymentsHub from "./pages/admin/payments/PaymentsHub";

// Migration pages - New complete system
import { ClientMigrationPage } from "./pages/admin/ClientMigrationPage";

// Settings pages
import GeneralSettings from "./pages/admin/settings/GeneralSettings";
import PaymentGatewaySettings from "./pages/admin/settings/PaymentGatewaySettings";
import StudioSettings from "./pages/admin/settings/StudioSettings";
import PartnerPlatforms from "./pages/admin/settings/PartnerPlatforms";
import PoliciesSettings from "./pages/admin/settings/PoliciesSettings";
import NotificationSettings from "./pages/admin/settings/NotificationSettings";
import ClosedDays from "./pages/admin/settings/ClosedDays";
import WhatsAppSettings from "./pages/admin/settings/WhatsAppSettings";

// Loyalty pages
import LoyaltyConfig from "./pages/admin/loyalty/LoyaltyConfig";
import LoyaltyRewards from "./pages/admin/loyalty/LoyaltyRewards";
import LoyaltyRedemptions from "./pages/admin/loyalty/LoyaltyRedemptions";
import LoyaltyAdjust from "./pages/admin/loyalty/LoyaltyAdjust";

// Reports pages
import ReportsOverview from "./pages/admin/reports/ReportsOverview";
import ReportsClasses from "./pages/admin/reports/ReportsClasses";
import ReportsRevenue from "./pages/admin/reports/ReportsRevenue";
import ReportsRetention from "./pages/admin/reports/ReportsRetention";
import ReportsInstructors from "./pages/admin/reports/ReportsInstructors";
import ReportsEgresos from "./pages/admin/reports/ReportsEgresos";
import InstructorDetail from "./pages/admin/reports/InstructorDetail";

// Referrals page
import Referrals from "./pages/admin/referrals/Referrals";

// Facilities page
import FacilitiesList from "./pages/admin/facilities/FacilitiesList";

// Orders/Payments verification page


// Admin Video Management
import AdminVideoList from "./pages/admin/videos/VideoList";
import AdminVideoUpload from "./pages/admin/videos/VideoUpload";
import VideoSalesVerification from "./pages/admin/videos/VideoSalesVerification";
import EventsManager from "./pages/admin/events/EventsManager";
import DiscountCodes from "./pages/admin/discount-codes/DiscountCodes";
import ProductsPage from "./pages/admin/pos/ProductsPage";
import POSPage from "./pages/admin/pos/POSPage";

// Coach pages
import CoachLogin from "./pages/auth/CoachLogin";
import CoachDashboard from "./pages/coach/Dashboard";
import CoachSchedule from "./pages/coach/Schedule";
import CoachClassDetail from "./pages/coach/ClassDetail";
import CoachProfile from "./pages/coach/Profile";
import CoachHistory from "./pages/coach/History";
import CoachSubstitutions from "./pages/coach/Substitutions";
import CoachPlaylists from "./pages/coach/Playlists";
import CoachTemplates from "./pages/coach/Templates";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

// Component to check auth on app load
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}

function LegacyClientBookRedirect() {
  const { classId } = useParams();
  return <Navigate to={classId ? `/app/book/${classId}` : "/app/book"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Checkout />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cancellation-policy" element={<CancellationPolicy />} />

            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Instructor Auth Routes */}
            <Route path="/instructor/access" element={<InstructorAccess />} />
            <Route path="/instructor/magic-login" element={<InstructorMagicLogin />} />

            {/* Client Routes */}
            <Route path="/app" element={<ClientDashboard />} />
            <Route path="/app/book" element={<BookClasses />} />
            <Route path="/app/book/:classId" element={<BookClassConfirm />} />
            <Route path="/app/classes" element={<MyBookings />} />
            <Route path="/app/classes/:bookingId" element={<ClassBookingDetail />} />
            <Route path="/app/wallet" element={<WalletClub />} />
            <Route path="/app/wallet/rewards" element={<WalletRewards />} />
            <Route path="/app/wallet/history" element={<WalletHistory />} />
            <Route path="/app/profile" element={<ClientProfile />} />
            <Route path="/app/profile/edit" element={<ProfileEdit />} />
            <Route path="/app/profile/membership" element={<ProfileMembership />} />
            <Route path="/app/profile/preferences" element={<ProfilePreferences />} />
            <Route path="/app/refer" element={<ReferFriends />} />
            <Route path="/app/notifications" element={<Notifications />} />
            <Route path="/app/news" element={<News />} />
            <Route path="/app/checkout" element={<ClientCheckout />} />
            <Route path="/app/orders" element={<ClientOrders />} />
            <Route path="/app/orders/:orderId" element={<ClientOrderDetail />} />
            <Route path="/app/videos" element={<VideoLibrary />} />
            <Route path="/app/videos/:videoId" element={<VideoPlayer />} />
            <Route path="/app/events" element={<ClientEvents />} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/events" element={<EventsManager />} />
            <Route path="/admin/discount-codes" element={<DiscountCodes />} />
            <Route path="/admin/calendar" element={<ClassesCalendar />} />

            <Route path="/admin/bookings" element={<BookingsList />} />
            <Route path="/admin/bookings/waitlist" element={<Waitlist />} />
            <Route path="/admin/bookings/partners-checkins" element={<PartnerCheckins />} />

            <Route path="/admin/classes/schedules" element={<WeeklySchedule />} />
            <Route path="/admin/classes/types" element={<ClassTypesList />} />
            <Route path="/admin/classes/generate" element={<GenerateClasses />} />
            <Route path="/admin/classes/templates" element={<WorkoutTemplates />} />

            <Route path="/admin/members" element={<ClientsList />} />
            <Route path="/admin/members/new" element={<MemberNew />} />
            <Route path="/admin/members/:userId/assign-membership" element={<AssignMembership />} />
            <Route path="/admin/members/:userId/physical-sale" element={<PhysicalSale />} />
            <Route path="/admin/members/:id" element={<ClientDetail />} />

            <Route path="/admin/memberships/pending" element={<PendingMemberships />} />
            <Route path="/admin/memberships/active" element={<MembershipsActive />} />
            <Route path="/admin/memberships/expiring" element={<MembershipsExpiring />} />
            <Route path="/admin/memberships/all" element={<MembershipsAll />} />
            <Route path="/admin/memberships" element={<Navigate to="/admin/memberships/all" replace />} />
            <Route path="/admin/instructors" element={<InstructorsList />} />
            <Route path="/admin/payments" element={<PaymentsHub />} />
            <Route path="/admin/payments/transactions" element={<Navigate to="/admin/payments" replace />} />
            <Route path="/admin/payments/pending" element={<Navigate to="/admin/payments" replace />} />
            <Route path="/admin/payments/register" element={<Navigate to="/admin/payments" replace />} />
            <Route path="/admin/payments/reports" element={<Navigate to="/admin/payments" replace />} />

            <Route path="/admin/loyalty/config" element={<LoyaltyConfig />} />
            <Route path="/admin/loyalty/rewards" element={<LoyaltyRewards />} />
            <Route path="/admin/loyalty/redemptions" element={<LoyaltyRedemptions />} />
            <Route path="/admin/loyalty/adjust" element={<LoyaltyAdjust />} />

            <Route path="/admin/referrals" element={<Referrals />} />

            <Route path="/admin/reports/overview" element={<ReportsOverview />} />
            <Route path="/admin/reports/classes" element={<ReportsClasses />} />
            <Route path="/admin/reports/revenue" element={<ReportsRevenue />} />
            <Route path="/admin/reports/retention" element={<ReportsRetention />} />
            <Route path="/admin/reports/instructors/:id" element={<InstructorDetail />} />
            <Route path="/admin/reports/instructors" element={<ReportsInstructors />} />
            <Route path="/admin/reports/egresos" element={<ReportsEgresos />} />

            <Route path="/admin/settings/general" element={<GeneralSettings />} />
            <Route path="/admin/settings/studio" element={<StudioSettings />} />
            <Route path="/admin/settings/payments" element={<PaymentGatewaySettings />} />
            <Route path="/admin/settings/platforms" element={<PartnerPlatforms />} />
            <Route path="/admin/settings/policies" element={<PoliciesSettings />} />
            <Route path="/admin/settings/notifications" element={<NotificationSettings />} />
            <Route path="/admin/settings/closed-days" element={<ClosedDays />} />
            <Route path="/admin/settings/whatsapp" element={<WhatsAppSettings />} />
            <Route path="/admin/settings" element={<Navigate to="/admin/settings/general" replace />} />

            {/* Migration History Route - Only for reports */}
            <Route path="/admin/migrations/history" element={<ClientMigrationPage />} />

            <Route path="/admin/facilities" element={<FacilitiesList />} />
            <Route path="/admin/orders" element={<Navigate to="/admin/payments" replace />} />
            <Route path="/admin/orders/verification" element={<Navigate to="/admin/payments" replace />} />

            {/* POS System */}
            <Route path="/admin/products" element={<ProductsPage />} />
            <Route path="/admin/pos" element={<POSPage />} />

            {/* Admin Video Management */}
            <Route path="/admin/videos" element={<AdminVideoList />} />
            <Route path="/admin/videos/upload" element={<AdminVideoUpload />} />
            <Route path="/admin/videos/edit/:id" element={<AdminVideoUpload />} />
            <Route path="/admin/videos/sales" element={<VideoSalesVerification />} />

            {/* Coach Routes */}
            <Route path="/coach/login" element={<CoachLogin />} />
            <Route path="/coach" element={<CoachDashboard />} />
            <Route path="/coach/schedule" element={<CoachSchedule />} />
            <Route path="/coach/class/:classId" element={<CoachClassDetail />} />
            <Route path="/coach/profile" element={<CoachProfile />} />
            <Route path="/coach/history" element={<CoachHistory />} />
            <Route path="/coach/substitutions" element={<CoachSubstitutions />} />
            <Route path="/coach/playlists" element={<CoachPlaylists />} />
            <Route path="/coach/templates" element={<CoachTemplates />} />

            {/* Legacy redirects */}
            <Route path="/admin/clients" element={<ClientsList />} />
            <Route path="/admin/clients/:id" element={<ClientDetail />} />
            <Route path="/admin/class-types" element={<Navigate to="/admin/classes/types" replace />} />
            <Route path="/admin/schedules" element={<Navigate to="/admin/classes/schedules" replace />} />
            <Route path="/admin/plans" element={<PlansList />} />
            <Route path="/admin/bookings/calendar" element={<Navigate to="/admin/calendar" replace />} />

            {/* Redirects */}
            <Route path="/client/dashboard" element={<Navigate to="/app" replace />} />
            <Route path="/auth/register" element={<Navigate to="/register" replace />} />
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/client/book" element={<Navigate to="/app/book" replace />} />
            <Route path="/client/book/:classId" element={<LegacyClientBookRedirect />} />
            <Route path="/app/my-bookings" element={<Navigate to="/app/classes" replace />} />
            <Route path="/client/my-bookings" element={<Navigate to="/app/classes" replace />} />
            <Route path="/client/wallet" element={<Navigate to="/app/wallet" replace />} />
            <Route path="/client/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="/client/*" element={<Navigate to="/app" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* WhatsApp floating button - global */}
          <a
            href="https://wa.me/525574034316?text=Hola%20Essenza%20del%20Flusso%2C%20tengo%20una%20duda"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed z-[9999] bg-[#25D366] hover:bg-[#1fb855] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
            style={{ right: '20px', bottom: '24px', width: '56px', height: '56px' }}
            title="¿Dudas? Escríbenos por WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </AuthInitializer>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
