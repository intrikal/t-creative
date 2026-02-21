/**
 * Mock reviews data — shared between the admin Reviews dashboard and the
 * public-facing Testimonials section on the landing page.
 *
 * Shape matches what a DB query against the `reviews` table would return
 * (joined with the client's profile for name/initials). Swap this out for
 * a server action / DB query when the backend is ready.
 *
 * Landing page rule: only reviews with `status === "featured"` are shown.
 * Trini controls which reviews are featured from the admin dashboard.
 */

export type ReviewStatus = "pending" | "approved" | "featured" | "hidden";
export type ReviewSource = "google" | "website" | "instagram" | "yelp";
export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "training";

export interface Review {
  id: number;
  client: string;
  initials: string;
  rating: number;
  service: ServiceCategory;
  source: ReviewSource;
  date: string;
  text: string;
  status: ReviewStatus;
  reply?: string;
}

export const MOCK_REVIEWS: Review[] = [
  {
    id: 1,
    client: "Sarah Mitchell",
    initials: "SM",
    rating: 5,
    service: "lash",
    source: "google",
    date: "Feb 20, 2026",
    text: "Trini is absolutely amazing! My volume lashes looked stunning for my graduation and lasted over 5 weeks. She is so gentle and makes you feel at ease the entire time. Will never go anywhere else!",
    status: "featured",
    reply:
      "Thank you so much Sarah! It was such a pleasure doing your lashes for such a special occasion. Can't wait to see you for your fill! 🥰",
  },
  {
    id: 2,
    client: "Maya Robinson",
    initials: "MR",
    rating: 5,
    service: "lash",
    source: "website",
    date: "Feb 18, 2026",
    text: "Best lash tech in San Jose, hands down. My lashes are always perfect and Trini always remembers exactly how I like them. The studio is clean and the vibe is so calming.",
    status: "featured",
  },
  {
    id: 3,
    client: "Destiny Cruz",
    initials: "DC",
    rating: 5,
    service: "jewelry",
    source: "instagram",
    date: "Feb 17, 2026",
    text: "Got my permanent anklet done and I literally haven't taken it off since!! The process was so quick and painless. Trini has the best eye for placement. Obsessed.",
    status: "pending",
  },
  {
    id: 4,
    client: "Marcus Webb",
    initials: "MW",
    rating: 5,
    service: "consulting",
    source: "website",
    date: "Feb 15, 2026",
    text: "Trini's business consulting sessions completely transformed how I think about building my team. She gave me frameworks I could implement immediately. Incredibly worth it.",
    status: "featured",
  },
  {
    id: 5,
    client: "Keisha Williams",
    initials: "KW",
    rating: 4,
    service: "crochet",
    source: "google",
    date: "Feb 14, 2026",
    text: "Loved my crochet braids! The install was comfortable and the style came out exactly as I described. Only minor note is it took a little longer than expected but the result was worth it.",
    status: "approved",
    reply:
      "Thank you Keisha! I appreciate the honest feedback — I'm working on timing for installs. So glad you love the style! 💛",
  },
  {
    id: 6,
    client: "Amara Johnson",
    initials: "AJ",
    rating: 5,
    service: "lash",
    source: "google",
    date: "Feb 12, 2026",
    text: "First time getting lash extensions and Trini made the whole experience so comfortable. She explained every step and the results were beyond what I imagined. Definitely coming back!",
    status: "pending",
  },
  {
    id: 7,
    client: "Nina Patel",
    initials: "NP",
    rating: 5,
    service: "jewelry",
    source: "yelp",
    date: "Feb 10, 2026",
    text: "Got matching permanent bracelets with my bestie and it was such a fun experience. Trini has a great selection of chains and the welding is seamless. 10/10!",
    status: "featured",
  },
  {
    id: 8,
    client: "Tanya Brown",
    initials: "TB",
    rating: 3,
    service: "lash",
    source: "google",
    date: "Feb 8, 2026",
    text: "Lashes looked good initially but had some retention issues after 2 weeks. May have been my aftercare but expected a bit more longevity for the price.",
    status: "pending",
  },
];

export const RATING_DIST = [
  { stars: 5, count: 31, pct: 74 },
  { stars: 4, count: 7, pct: 17 },
  { stars: 3, count: 3, pct: 7 },
  { stars: 2, count: 1, pct: 2 },
  { stars: 1, count: 0, pct: 0 },
];
