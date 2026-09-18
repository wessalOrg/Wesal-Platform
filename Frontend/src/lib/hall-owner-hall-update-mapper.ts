import { toHallRegionApi, toTimeOnlyApi } from "@/lib/hall-owner-api-region";
import { toOwnerPhotoApiUrl } from "@/lib/hall-owner-hall-management-mapper";
import { normalizeRegisterPhone } from "@/lib/register-validation";
import type { HallEditFormValues } from "@/types/hall-owner-hall-management";

export type UpdateOwnerHallPhotoDto = {
  url: string;
  displayOrder: number;
};

export type UpdateOwnerHallBookingPeriodDto = {
  type: "FirstPeriod" | "SecondPeriod";
  startTime: string;
  endTime: string;
};

/**
 * wesal-api UpdateOwnerHallRequest (JSON).
 * Photos are URLs only — new File uploads are not part of this contract.
 */
export type UpdateOwnerHallRequest = {
  name: string;
  mainImageUrl: string | null;
  contactPhone: string | null;
  region: string;
  address: string;
  description: string | null;
  capacity: number;
  price: number | null;
  showPrice: boolean;
  photos: UpdateOwnerHallPhotoDto[];
  bookingPeriods: UpdateOwnerHallBookingPeriodDto[];
};

/**
 * Builds the JSON update payload matching wesal-api UpdateOwnerHallRequest.
 */
export function mapHallFormToUpdateHallRequest(
  values: HallEditFormValues,
): UpdateOwnerHallRequest {
  const region = toHallRegionApi(values.region);
  if (!region) {
    throw new Error("owner.management.addHall.errors.regionRequired");
  }

  const photos: UpdateOwnerHallPhotoDto[] = values.existingPhotos.map(
    (photo, index) => ({
      url: toOwnerPhotoApiUrl(photo),
      displayOrder: index,
    }),
  );

  const priceRaw = values.rentalPrice.trim();
  const price = priceRaw === "" ? null : Number.parseFloat(priceRaw);

  return {
    name: values.hallName.trim(),
    mainImageUrl: photos[0]?.url ?? null,
    contactPhone: normalizeRegisterPhone(values.ownerPhone) || null,
    region,
    address: values.detailedAddress.trim(),
    description: values.description.trim() || null,
    capacity: Number.parseInt(values.guestCapacity.trim(), 10),
    price: Number.isFinite(price as number) ? (price as number) : null,
    showPrice: priceRaw !== "",
    photos,
    bookingPeriods: [
      {
        type: "FirstPeriod",
        startTime: toTimeOnlyApi(values.firstPeriod.startTime),
        endTime: toTimeOnlyApi(values.firstPeriod.endTime),
      },
      {
        type: "SecondPeriod",
        startTime: toTimeOnlyApi(values.secondPeriod.startTime),
        endTime: toTimeOnlyApi(values.secondPeriod.endTime),
      },
    ],
  };
}
