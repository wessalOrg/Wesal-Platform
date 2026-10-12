import MabroukStudioPage from "@/components/admin/mabrouk/MabroukStudioPage";

export default async function MabroukSimulatorRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string | string[] }>;
}) {
  const params = await searchParams;
  const question = typeof params.question === "string" ? params.question : "";
  return <MabroukStudioPage section="simulator" simulatorQuestion={question} />;
}
