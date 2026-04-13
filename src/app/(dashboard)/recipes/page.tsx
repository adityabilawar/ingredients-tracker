import { RecipesClient } from "./recipes-client";

export default function RecipesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <RecipesClient />
    </div>
  );
}
