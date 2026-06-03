
// ============================================
// FILE: middleware.ts (Root level)
// Auth & Security Middleware
// ============================================

import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: ["/", "/login", "/register", "/api/webhooks/(.*)"],

  // Routes that should redirect to login if not authenticated
  ignoredRoutes: ["/api/public/(.*)"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
