import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorScreen, NotFoundScreen } from "./components/app-shell/error-screens";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
    // Every route uses our screens, never the framework's built-in error
    // screen, whose "Show Error" button reveals raw error text (P1-05).
    defaultErrorComponent: ErrorScreen,
    defaultNotFoundComponent: NotFoundScreen,
  });

  return router;
};
