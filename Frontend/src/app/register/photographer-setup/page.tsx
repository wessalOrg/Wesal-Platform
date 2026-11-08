import PhotographerSetupScreen from "@/components/auth/photographer-setup/PhotographerSetupScreen";

type PhotographerSetupPageProps = {
  searchParams: Promise<{ preview?: string; mode?: string }>;
};

export default async function PhotographerSetupPage({
  searchParams,
}: PhotographerSetupPageProps) {
  const { preview, mode } = await searchParams;
  const previewOn =
    preview === "1" || preview === "true" || preview === "pending" || preview === "resubmit";
  const resubmit =
    mode === "edit" || mode === "resubmit" || preview === "resubmit";
  return (
    <PhotographerSetupScreen
      preview={previewOn}
      previewPending={preview === "pending"}
      resubmit={resubmit}
    />
  );
}
