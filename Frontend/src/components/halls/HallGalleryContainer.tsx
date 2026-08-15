import HallGallery from "@/components/halls/HallGallery";

type HallGalleryContainerProps = {
  images: string[];
  hallName: string;
};

/**
 * Layout integration point for the hall photo gallery.
 * Data is passed from the parent page — no fetching here.
 */
export default function HallGalleryContainer({
  images,
  hallName,
}: HallGalleryContainerProps) {
  return (
    <section aria-label="معرض صور القاعة" className="min-w-0">
      <HallGallery images={images} hallName={hallName} />
    </section>
  );
}
