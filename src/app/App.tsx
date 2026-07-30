import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppContent } from "./components/AppContent";
import { PortalLanding } from "./components/PortalLanding";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PortalLanding />} />
          <Route path="/user/*" element={<AppContent portal="user" />} />
          <Route path="/admin/*" element={<AppContent portal="admin" />} />
          <Route path="/system/*" element={<AppContent portal="system" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
