export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/class/:path*",
    "/admin/:path*",
    "/settings/:path*",
    "/api/dashboard/:path*",
    "/api/classes/:path*",
    "/api/assignments/:path*",
    "/api/grades/:path*",
    "/api/notifications/:path*",
    "/api/admin/:path*",
    "/api/uploads/:path*",
    "/api/import/:path*",
  ],
};
