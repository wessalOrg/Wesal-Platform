import type { Metadata } from "next";
import HallDetailsView from "@/components/halls/HallDetailsView";

type HallDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: HallDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "تفاصيل القاعة | وصال",
    description: `عرض تفاصيل القاعة (${id}) على منصة وصال.`,
  };
}

export default async function HallDetailsPage({ params }: HallDetailsPageProps) {
  const { id } = await params;
  return <HallDetailsView hallId={id} />;
}
