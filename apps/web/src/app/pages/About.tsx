import { PublicAuthorityPage } from "@/app/components/PublicAuthorityPage";
import { ABOUT_CONTENT } from "@/app/content/public/aboutContent";

export function About() {
  return <PublicAuthorityPage {...ABOUT_CONTENT} />;
}
