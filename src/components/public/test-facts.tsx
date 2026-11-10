import { bn } from "@/i18n/bn";

type TestInfo = { sampleType: string | null; description: string | null; preparationNote: string | null; contentStatus: string };

const SAMPLE_BN: Record<string, string> = { Blood: "রক্ত", Urine: "প্রস্রাব", Stool: "মল" };

/**
 * Sample type, plus description / preparation ONLY when an admin marked them REVIEWED
 * (medical content rule: draft text is never shown publicly).
 */
export function TestFacts({ test }: { test: TestInfo }) {
  const reviewed = test.contentStatus === "REVIEWED";
  const description = reviewed ? test.description : null;
  const preparation = reviewed ? test.preparationNote : null;
  if (!test.sampleType && !description && !preparation) return null;
  return (
    <dl className="mt-3 space-y-2 text-sm">
      {test.sampleType && (
        <div className="flex gap-2"><dt className="font-semibold">{bn.sampleType}:</dt><dd>{SAMPLE_BN[test.sampleType] ?? test.sampleType}</dd></div>
      )}
      {preparation && <div><dt className="font-semibold">{bn.preparation}</dt><dd className="mt-1 whitespace-pre-line">{preparation}</dd></div>}
      {description && <div><dt className="font-semibold">{bn.aboutTest}</dt><dd className="mt-1 whitespace-pre-line">{description}</dd></div>}
    </dl>
  );
}
