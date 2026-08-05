import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AppShell from "@/components/layout/AppShell";
import MelCalculator from "@/pages/MelCalculator";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={MelCalculator} />
      <Route path="/documents" component={() => <div className="p-12 text-center text-muted-foreground"><h2 className="text-2xl font-heading text-foreground mb-2">Documents</h2><p>Coming Soon</p></div>} />
      <Route path="/history" component={() => <div className="p-12 text-center text-muted-foreground"><h2 className="text-2xl font-heading text-foreground mb-2">History</h2><p>Coming Soon</p></div>} />
      <Route path="/settings" component={() => <div className="p-12 text-center text-muted-foreground"><h2 className="text-2xl font-heading text-foreground mb-2">Settings</h2><p>Coming Soon</p></div>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell>
            <Router />
          </AppShell>
        </WouterRouter>
        <Toaster theme="dark" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
