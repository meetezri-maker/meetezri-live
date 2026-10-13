import { PublicAuthorityPage } from "@/app/components/PublicAuthorityPage";
import { SAFETY_CONTENT } from "@/app/content/public/safetyContent";

export function Safety() {
  return <PublicAuthorityPage {...SAFETY_CONTENT} />;
}
