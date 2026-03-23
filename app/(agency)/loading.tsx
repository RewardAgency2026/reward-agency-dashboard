export default function AgencyLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded-md bg-gray-200" />
      <div className="h-4 w-96 rounded-md bg-gray-200" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
