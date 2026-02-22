import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);
const isPublicRoute = createRouteMatcher(['/api/webhooks(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Webhook routes must remain public — they come from Clerk's servers,
  // not from authenticated users.
  if (isPublicRoute(req)) return;

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
