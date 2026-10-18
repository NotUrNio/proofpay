export default function GlobalLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-44 rounded-2xl bg-[#161B22] border border-[#30363D] skeleton-shimmer" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 rounded-xl bg-[#161B22] border border-[#30363D] skeleton-shimmer" />
        <div className="h-32 rounded-xl bg-[#161B22] border border-[#30363D] skeleton-shimmer" />
        <div className="h-32 rounded-xl bg-[#161B22] border border-[#30363D] skeleton-shimmer" />
      </div>
      <div className="h-72 rounded-2xl bg-[#161B22] border border-[#30363D] skeleton-shimmer" />
    </div>
  );
}

