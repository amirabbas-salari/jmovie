const SectionTitle = ({ children }) => (
  <h2 className="mb-6 flex items-center gap-3 text-xl font-black text-white sm:text-2xl">
    <span className="block h-7 w-1.5 rounded-full bg-brand-gradient shadow-glow-sm" />
    {children}
  </h2>
);

export default SectionTitle;
