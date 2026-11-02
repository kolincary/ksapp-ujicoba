import { MeiliSearch } from "meilisearch";

export const meiliClient = new MeiliSearch({
  host: "http://127.0.0.1:7700",
});
