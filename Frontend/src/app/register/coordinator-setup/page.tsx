import CoordinatorSetupScreen from "@/components/auth/coordinator-setup/CoordinatorSetupScreen";

type CoordinatorSetupPageProps = {
  searchParams: Promise<{ preview?: string; mode?: string }>;
};

export default async function CoordinatorSetupPage({
  searchParams,
}: CoordinatorSetupPageProps) {
  const { preview, mode } = await searchParams;
  const previewOn = preview === "1" || preview === "true" || preview === "pending";
  const resubmit =
    mode === "edit" || mode === "resubmit" || preview === "resubmit";
  return (
    <CoordinatorSetupScreen
      preview={previewOn || preview === "resubmit"}
      previewPending={preview === "pending"}
      resubmit={resubmit}
    />
  );
}
