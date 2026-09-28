import "./globals.css";

export const metadata = {
  title: "Backend Development Test",
  description: "Backend Development test: ES6, React.js, Express.js, MongoDB, Firebase, Netlify, Vercel and LinkedIn",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
