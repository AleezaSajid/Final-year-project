/** Shared mock tailors + filter helpers for Browse / public profile (UI demo). */

/**
 * `tailorShopId` — id the backend / tailor dashboard uses for routing orders (demo: all mock rows use T-A1).
 * Replace with real shop ids from your API when Browse is wired to production data.
 */
export const BROWSE_TAILORS = [
  {
    id: "1",
    tailorShopId: "T-A1",
    name: "Ayesha Khan",
    city: "Lahore",
    specialty: "Bridal & Formal",
    rating: 4.9,
    experienceYears: 8,
    distanceKm: 2.1,
    availability: "available",
    priceLabel: "Starting from PKR 2,500",
    priceStart: 2500,
    deliveryDays: 5,
    imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "2",
    tailorShopId: "T-A1",
    name: "Fatima Noor",
    city: "Karachi",
    specialty: "Casual Wear",
    rating: 4.7,
    experienceYears: 5,
    distanceKm: 3.4,
    availability: "busy",
    priceLabel: "Starting from PKR 1,500",
    priceStart: 1500,
    deliveryDays: 7,
    imageUrl: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "3",
    tailorShopId: "T-A1",
    name: "Sana Malik",
    city: "Islamabad",
    specialty: "Alterations & Repairs",
    rating: 4.8,
    experienceYears: 12,
    distanceKm: 1.2,
    availability: "available",
    priceLabel: "Starting from PKR 800",
    priceStart: 800,
    deliveryDays: 3,
    imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "4",
    tailorShopId: "T-A1",
    name: "Hira Tariq",
    city: "Lahore",
    specialty: "Kids & Party Wear",
    rating: 4.6,
    experienceYears: 6,
    distanceKm: 4.8,
    availability: "available",
    priceLabel: "Starting from PKR 1,200",
    priceStart: 1200,
    deliveryDays: 6,
    imageUrl: "https://images.unsplash.com/photo-1620799140408-ed534d95d350?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "5",
    tailorShopId: "T-A1",
    name: "Rabia Sheikh",
    city: "Rawalpindi",
    specialty: "Bridal Couture",
    rating: 5.0,
    experienceYears: 10,
    distanceKm: 5.2,
    availability: "busy",
    priceLabel: "Starting from PKR 4,000",
    priceStart: 4000,
    deliveryDays: 14,
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "6",
    tailorShopId: "T-A1",
    name: "Zainab Hussain",
    city: "Faisalabad",
    specialty: "Traditional & Festive",
    rating: 4.5,
    experienceYears: 4,
    distanceKm: 6.0,
    availability: "available",
    priceLabel: "Starting from PKR 1,800",
    priceStart: 1800,
    deliveryDays: 10,
    imageUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "7",
    tailorShopId: "T-A1",
    name: "Maryam Iqbal",
    city: "Multan",
    specialty: "Western & Fusion",
    rating: 4.7,
    experienceYears: 7,
    distanceKm: 2.9,
    availability: "available",
    priceLabel: "Starting from PKR 2,200",
    priceStart: 2200,
    deliveryDays: 8,
    imageUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=450&fit=crop&q=80",
  },
];

export const RATING_OPTIONS = [
  { value: "any", label: "Any rating" },
  { value: "4", label: "4★ & above" },
  { value: "4.5", label: "4.5★ & above" },
];

export const PRICE_OPTIONS = [
  { value: "any", label: "Any price" },
  { value: "low", label: "Under PKR 1,500" },
  { value: "mid", label: "PKR 1,500 – 2,500" },
  { value: "high", label: "Above PKR 2,500" },
];

export const DELIVERY_OPTIONS = [
  { value: "any", label: "Any timeframe" },
  { value: "fast", label: "Within 5 days" },
  { value: "standard", label: "6 – 10 days" },
  { value: "flex", label: "10+ days" },
];

export const EXPERIENCE_BAR_OPTIONS = [
  { value: "any", label: "Any experience" },
  { value: "5", label: "5+ years" },
  { value: "10", label: "10+ years" },
];

export const CATEGORY_LABELS = ["Women's Wear", "Men's Wear", "Bridal", "Alterations"];

export const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "orders", label: "Most experienced" },
];

/** URL codes ↔ sidebar category labels */
export const CATEGORY_CODES = {
  women: "Women's Wear",
  men: "Men's Wear",
  bridal: "Bridal",
  alter: "Alterations",
};

export function categorySetFromParam(param) {
  if (!param || !String(param).trim()) return new Set();
  const set = new Set();
  String(param)
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .forEach((code) => {
      const label = CATEGORY_CODES[code];
      if (label) set.add(label);
    });
  return set;
}

export function categoryParamFromSet(categoryUi) {
  if (!categoryUi || categoryUi.size === 0) return "";
  const codes = [];
  for (const label of categoryUi) {
    const entry = Object.entries(CATEGORY_CODES).find(([, l]) => l === label);
    if (entry) codes.push(entry[0]);
  }
  return codes.join(",");
}

function specialtyMatchesCategory(category, specialtyLower) {
  if (category === "Bridal") {
    return /bridal|couture|formal|wedding/.test(specialtyLower);
  }
  if (category === "Alterations") {
    return /alteration|repair|alter/.test(specialtyLower);
  }
  if (category === "Men's Wear") {
    return /\bmen|groom|kurta|waistcoat|suit\b/.test(specialtyLower);
  }
  if (category === "Women's Wear") {
    return (
      /kids|party|casual|western|fusion|traditional|festive|ladies|women/.test(specialtyLower) ||
      /bridal|formal/.test(specialtyLower)
    );
  }
  return false;
}

/**
 * @param {typeof BROWSE_TAILORS[0]} tailor
 * @param {{ search: string; rating: string; price: string; delivery: string; experienceBar: string; categoryUi: Set<string> }} filters
 */
export function matchesFilters(tailor, { search, rating, price, delivery, experienceBar, categoryUi }) {
  const q = search.trim().toLowerCase();
  if (q) {
    const blob = `${tailor.name} ${tailor.city} ${tailor.specialty}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  if (rating !== "any" && tailor.rating < Number(rating)) return false;
  if (price === "low" && tailor.priceStart >= 1500) return false;
  if (price === "mid" && (tailor.priceStart < 1500 || tailor.priceStart > 2500)) return false;
  if (price === "high" && tailor.priceStart <= 2500) return false;
  if (delivery === "fast" && tailor.deliveryDays > 5) return false;
  if (delivery === "standard" && (tailor.deliveryDays < 6 || tailor.deliveryDays > 10)) return false;
  if (delivery === "flex" && tailor.deliveryDays <= 10) return false;
  if (experienceBar === "5" && tailor.experienceYears < 5) return false;
  if (experienceBar === "10" && tailor.experienceYears < 10) return false;
  if (categoryUi && categoryUi.size > 0) {
    const spec = tailor.specialty.toLowerCase();
    const ok = [...categoryUi].some((cat) => specialtyMatchesCategory(cat, spec));
    if (!ok) return false;
  }
  return true;
}

export function getTailorById(id) {
  return BROWSE_TAILORS.find((t) => String(t.id) === String(id)) ?? null;
}
