import { redirect } from "next/navigation";
import { REGULAR_PROFILE_PATH } from "@/lib/account-profile-path";

/** Canonical favorites workspace lives under the seeker dashboard shell. */
export default function FavoritesAliasPage() {
  redirect(`${REGULAR_PROFILE_PATH}/favorites`);
}
