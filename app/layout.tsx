import './globals.css';

export const metadata = {
  title: 'AVISI Hackathon App',
  description: 'Hackathon project using Vercel, Supabase, and Nodemailer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
