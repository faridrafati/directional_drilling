interface Props { title: string; phase?: string }

export function PlaceholderPage({ title, phase }: Props) {
  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      {phase && (
        <p className="text-sm text-gray-500 mb-4">
          Scheduled for <span className="font-medium">{phase}</span>. See{" "}
          <code className="bg-gray-100 px-1 rounded">REACT_CONVERSION_PROMPT.md</code> for the
          full specification.
        </p>
      )}
      <p className="text-gray-700">This screen is not built yet.</p>
    </div>
  );
}
