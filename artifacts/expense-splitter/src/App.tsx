import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import EventList from "@/pages/EventList";
import EventDetail from "@/pages/EventDetail";
import Statistics from "@/pages/Statistics";
import SettingsPage from "@/pages/Settings";
import BottomNav from "@/components/BottomNav";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={EventList} />
      <Route path="/events/:id" component={EventDetail} />
      <Route path="/statistics" component={Statistics} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <BottomNav />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
