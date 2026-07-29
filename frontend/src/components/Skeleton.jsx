export function CardSkeleton({ className = '' }) {
  return (
    <div className={`skeleton h-28 ${className}`} />
  );
}

export function ChartSkeleton({ className = '' }) {
  return (
    <div className={`skeleton h-64 ${className}`} />
  );
}

export function LineSkeleton({ width = 'w-full', className = '' }) {
  return (
    <div className={`skeleton h-4 ${width} ${className}`} />
  );
}

export function TitleSkeleton() {
  return (
    <div className="space-y-2 mb-6">
      <LineSkeleton width="w-64" className="h-6" />
      <LineSkeleton width="w-96" className="h-3" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1" style={{ opacity: 1 - (i * 0.08) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function BadgeGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function LeaderboardSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-6 h-6 rounded-lg" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function ChallengesSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-12 rounded-md" />
            </div>
            <div className="skeleton h-3 w-64" />
            <div className="skeleton h-3 w-20" />
          </div>
          <div className="skeleton w-16 h-7 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function NarrativeSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="skeleton h-4 w-48" />
      <div className="skeleton h-20 w-full" />
      <div className="grid grid-cols-3 gap-4">
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </div>
    </div>
  );
}

export function ConfidenceGaugeSkeleton() {
  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px] space-y-4">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton w-40 h-40 rounded-full" />
      <div className="skeleton h-3 w-48" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <TitleSkeleton />
      <StatsGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CardSkeleton className="h-48" />
        <CardSkeleton className="h-48 lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <TitleSkeleton />
      <div className="flex gap-2 mb-6">
        <div className="skeleton h-8 w-24 rounded-lg" />
        <div className="skeleton h-8 w-28 rounded-lg" />
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="skeleton h-8 w-36" />
          <div className="skeleton h-8 w-28" />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}

export function GamificationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <TitleSkeleton />
      <StatsGridSkeleton count={3} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-6">
            <div className="skeleton h-4 w-44 mb-6" />
            <ChallengesSkeleton />
          </div>
          <div className="glass-card p-6">
            <div className="skeleton h-4 w-36 mb-6" />
            <BadgeGridSkeleton />
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="glass-card p-6">
            <div className="skeleton h-4 w-48 mb-6" />
            <LeaderboardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExplainableAISkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <TitleSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <NarrativeSkeleton />
        </div>
        <div className="lg:col-span-4">
          <ConfidenceGaugeSkeleton />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-5">
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
