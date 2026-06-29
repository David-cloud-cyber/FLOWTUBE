import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowTube",
  description: "SaaS conversationnel de création de médias par IA"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = <body>{children}</body>;

  return (
    <html lang="fr" className="dark">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <ClerkProvider>{body}</ClerkProvider>
      ) : (
        body
      )}
    </html>
  );
}
