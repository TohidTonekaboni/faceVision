import { QueryClient } from "@tanstack/react-query";

// Exported as a standalone module (rather than only living inside main.tsx)
// so non-component code — like snapshotSessionStore, which must keep running
// across route navigation and therefore can't rely on a React hook — can
// still invalidate queries after a background capture.
export const queryClient = new QueryClient();
