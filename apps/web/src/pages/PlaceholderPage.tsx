interface Props { title: string; phase?: string }

export function PlaceholderPage({ title, phase }: Props) {
  return (
    <div className="p-8 max-w-2xl">
      <div className="border-l-[3px] border-amber-500 pl-3 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h2>
        {phase && (
          <p className="text-sm text-gray-500 mt-0.5">
            Scheduled for <span className="font-medium">{phase}</span>. See{" "}
            <code className="bg-gray-100 px-1 rounded">REACT_CONVERSION_PROMPT.md</code> for the
            full specification.
          </p>
        )}
      </div>
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-8 sm:p-12 text-center">
        <p className="text-gray-500">This screen is not built yet.</p>
      </div>
    </div>
  );
}
