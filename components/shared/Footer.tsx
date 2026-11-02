export function Footer({ brand }: { brand: string }) {
  return (
    <footer className="mt-10 text-center text-xs text-white/50">
      © {new Date().getFullYear()} {brand}. All spins are verified securely on our server.
    </footer>
  );
}
