import { meiliClient } from "./meilisearch";

export const productsIndex = meiliClient.index("wms_products");
