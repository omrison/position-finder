import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { getUserOperationCount } from "@/lib/dal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Position Finder — Find Your Next Job in Israel",
  description:
    "Upload your CV and find the best-matching job openings in Israel, scored by AI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const searchCount = session?.user?.id
    ? await getUserOperationCount(session.user.id)
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session?.user && (
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{session.user.email}</span>
                {searchCount !== null && (
                  <span className="text-xs text-gray-400">
                    {searchCount} {searchCount === 1 ? "search" : "searches"}
                  </span>
                )}
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
