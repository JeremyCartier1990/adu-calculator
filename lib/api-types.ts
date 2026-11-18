export type PropertyFacts = {
  formattedAddress: string | null;
  squareFootage: number | null;
  lotSize: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ValueFacts = {
  price: number | null;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
};

export type PropertyLookup =
  | {
      ok: true;
      cached: boolean;
      formattedAddress: string | null;
      property: PropertyFacts;
      value: ValueFacts;
      warnings: string[];
    }
  | { ok: false; code: "not_found" | "not_configured" | "upstream"; message: string };

export type RentLookup =
  | {
      ok: true;
      cached: boolean;
      rent: number;
      rentRangeLow: number | null;
      rentRangeHigh: number | null;
      squareFootage: number;
      bedrooms: number;
    }
  | { ok: false; code: "not_found" | "not_configured" | "upstream"; message: string };
