export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="fade-up mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
      {children}
    </section>
  );
}
