import { getAvailableDates, getClipsForDate, formatDateHeading } from "@/lib/db";

export function generateStaticParams() {
  return getAvailableDates().map((date) => ({ date }));
}

export default async function DatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const clips = getClipsForDate(date);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <main className="max-w-6xl mx-auto">
        <a
          href="/"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; All dates
        </a>
        <h1 className="text-3xl font-bold mt-2 mb-8 text-zinc-900 dark:text-zinc-100">
          {formatDateHeading(date)}
        </h1>
        <div className="grid grid-cols-3 gap-4">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm"
            >
              <img
                src={`/${clip.thumbnailPath}`}
                alt={
                  clip.identifications[0]?.species ?? "Unidentified clip"
                }
                className="w-full aspect-video object-cover"
              />
              <div className="p-2">
                {clip.identifications.length === 0 && (
                  <p className="text-sm text-zinc-400">No identification</p>
                )}
                <div className="space-y-2">
                  {clip.identifications.map((ident, i) =>
                    ident.isBird ? (
                      <div
                        key={i}
                        className="text-sm text-zinc-700 dark:text-zinc-300"
                      >
                        <p>
                          {ident.species}
                          {ident.gender && ident.gender !== "unknown"
                            ? ` (${ident.gender})`
                            : ""}
                          {ident.count && ident.count > 1
                            ? ` ×${ident.count}`
                            : ""}
                        </p>
                        {ident.confidence != null && (
                          <p className="text-xs text-zinc-400">
                            {Math.round(parseFloat(ident.confidence) * 100)}% confidence
                          </p>
                        )}
                      </div>
                    ) : (
                      <p key={i} className="text-sm text-red-500">
                        {ident.nonBirdSpecies ?? "Not a bird"}
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
