import Link from "next/link";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

// ── Product SVG illustrations ─────────────────────────────────────────────────

function LashKitIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Pump bottle */}
      <rect
        x="72"
        y="70"
        width="36"
        height="80"
        rx="6"
        fill="#E8DFD0"
        stroke="#C4907A"
        strokeWidth="1.5"
      />
      <rect x="80" y="62" width="20" height="12" rx="3" fill="#C4907A" opacity="0.7" />
      <rect x="88" y="52" width="4" height="14" rx="2" fill="#C4907A" opacity="0.9" />
      <rect x="84" y="50" width="12" height="4" rx="2" fill="#C4907A" />
      {/* Label */}
      <rect x="78" y="100" width="24" height="32" rx="2" fill="white" opacity="0.6" />
      <line x1="82" y1="108" x2="98" y2="108" stroke="#C4907A" strokeWidth="1" opacity="0.5" />
      <line x1="82" y1="114" x2="98" y2="114" stroke="#C4907A" strokeWidth="1" opacity="0.5" />
      <line x1="82" y1="120" x2="92" y2="120" stroke="#C4907A" strokeWidth="1" opacity="0.5" />
      {/* Spoolie brush */}
      <line
        x1="126"
        y1="145"
        x2="140"
        y2="65"
        stroke="#2C2420"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse
        cx="141"
        cy="62"
        rx="5"
        ry="14"
        fill="#2C2420"
        opacity="0.15"
        transform="rotate(-15 141 62)"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={i}
          x1={135 + Math.sin(i * 0.9) * 5}
          y1={72 + i * 10}
          x2={147 + Math.sin(i * 0.9 + 1) * 5}
          y2={70 + i * 10}
          stroke="#2C2420"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />
      ))}
    </svg>
  );
}

function CleanserIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Tube body */}
      <rect
        x="68"
        y="68"
        width="44"
        height="90"
        rx="8"
        fill="#E8F4F0"
        stroke="#4e6b51"
        strokeWidth="1.5"
      />
      {/* Flip cap */}
      <rect x="68" y="58" width="44" height="18" rx="5" fill="#4e6b51" opacity="0.8" />
      <rect x="82" y="52" width="16" height="10" rx="3" fill="#4e6b51" />
      {/* Label area */}
      <rect x="74" y="88" width="32" height="48" rx="2" fill="white" opacity="0.5" />
      <rect x="78" y="92" width="24" height="3" rx="1" fill="#4e6b51" opacity="0.5" />
      {/* TC monogram */}
      <text
        x="90"
        y="122"
        textAnchor="middle"
        fontSize="14"
        fontFamily="serif"
        fill="#4e6b51"
        opacity="0.7"
        fontStyle="italic"
      >
        TC
      </text>
      <line x1="78" y1="128" x2="102" y2="128" stroke="#4e6b51" strokeWidth="0.8" opacity="0.4" />
      {/* Foam bubbles */}
      {[
        [152, 80, 5],
        [158, 92, 3.5],
        [148, 95, 4],
        [155, 106, 3],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#4e6b51" opacity="0.12" />
      ))}
    </svg>
  );
}

function JewelryIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Wrist form */}
      <ellipse cx="100" cy="130" rx="40" ry="14" fill="#F3EDE6" stroke="#D4A574" strokeWidth="1" />
      <rect
        x="60"
        y="80"
        width="80"
        height="50"
        rx="40"
        fill="#F3EDE6"
        stroke="#D4A574"
        strokeWidth="1"
      />
      {/* Chain bracelet */}
      <path
        d="M 62 108 Q 100 96 138 108"
        stroke="#D4A574"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Chain links */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const x = 65 + i * 10.5;
        const y = 107 - Math.sin((i / 7) * Math.PI) * 9;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="3.5"
            ry="2"
            fill="none"
            stroke="#D4A574"
            strokeWidth="1.5"
            transform={`rotate(${-30 + i * 8} ${x} ${y})`}
          />
        );
      })}
      {/* Weld point */}
      <circle cx="138" cy="108" r="3.5" fill="#D4A574" opacity="0.9" />
      <circle cx="138" cy="108" r="6" fill="none" stroke="#D4A574" strokeWidth="1" opacity="0.4" />
      {/* Sparkle */}
      {[
        [155, 72],
        [162, 82],
        [150, 85],
      ].map(([x, y], i) => (
        <g key={i}>
          <line
            x1={x}
            y1={y - 4}
            x2={x}
            y2={y + 4}
            stroke="#D4A574"
            strokeWidth="1"
            opacity="0.6"
          />
          <line
            x1={x - 4}
            y1={y}
            x2={x + 4}
            y2={y}
            stroke="#D4A574"
            strokeWidth="1"
            opacity="0.6"
          />
        </g>
      ))}
    </svg>
  );
}

function PrintedAccessoryIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Geometric pendant — hexagonal */}
      <polygon
        points="100,55 122,67 122,93 100,105 78,93 78,67"
        fill="#E8F3F3"
        stroke="#7BA3A3"
        strokeWidth="1.5"
      />
      {/* Inner detail */}
      <polygon
        points="100,65 116,74 116,91 100,100 84,91 84,74"
        fill="none"
        stroke="#7BA3A3"
        strokeWidth="1"
        opacity="0.5"
      />
      <polygon points="100,75 110,81 110,90 100,95 90,90 90,81" fill="#7BA3A3" opacity="0.2" />
      {/* Chain */}
      <path d="M100 55 Q100 40 100 30" stroke="#7BA3A3" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Layer lines — 3D print texture */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line
          key={i}
          x1="78"
          y1={67 + i * 3.8}
          x2="122"
          y2={67 + i * 3.8}
          stroke="#7BA3A3"
          strokeWidth="0.4"
          opacity="0.2"
        />
      ))}
      {/* Print bed below */}
      <rect x="60" y="130" width="80" height="6" rx="2" fill="#7BA3A3" opacity="0.15" />
      <rect x="65" y="118" width="70" height="14" rx="1" fill="#7BA3A3" opacity="0.08" />
      {/* Nozzle */}
      <rect x="96" y="108" width="8" height="14" rx="2" fill="#2C2420" opacity="0.2" />
      <polygon points="96,122 104,122 102,128 98,128" fill="#2C2420" opacity="0.25" />
      <circle cx="100" cy="129" r="2" fill="#7BA3A3" opacity="0.6" />
    </svg>
  );
}

function ToteBagIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Bag body */}
      <path
        d="M 58 85 L 62 158 Q 62 164 68 164 L 132 164 Q 138 164 138 158 L 142 85 Z"
        fill="#E8DFD0"
        stroke="#2C2420"
        strokeWidth="1.5"
      />
      {/* Bag top edge */}
      <rect x="56" y="80" width="88" height="8" rx="2" fill="#2C2420" opacity="0.15" />
      {/* Handles */}
      <path
        d="M 78 80 Q 78 58 90 58 Q 102 58 102 80"
        fill="none"
        stroke="#2C2420"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M 98 80 Q 98 58 110 58 Q 122 58 122 80"
        fill="none"
        stroke="#2C2420"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* TC logo on bag */}
      <rect x="80" y="106" width="40" height="30" rx="2" fill="white" opacity="0.4" />
      <text
        x="100"
        y="127"
        textAnchor="middle"
        fontSize="16"
        fontFamily="serif"
        fill="#2C2420"
        opacity="0.6"
        fontStyle="italic"
        fontWeight="300"
      >
        TC
      </text>
      {/* Canvas texture lines */}
      <line x1="62" y1="100" x2="138" y2="102" stroke="#2C2420" strokeWidth="0.5" opacity="0.1" />
      <line x1="61" y1="116" x2="139" y2="118" stroke="#2C2420" strokeWidth="0.5" opacity="0.1" />
      <line x1="61" y1="132" x2="139" y2="134" stroke="#2C2420" strokeWidth="0.5" opacity="0.1" />
      <line x1="61" y1="148" x2="139" y2="150" stroke="#2C2420" strokeWidth="0.5" opacity="0.1" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURED = [
  {
    name: "Lash Aftercare Kit",
    desc: "Oil-free cleanser + spoolie set. Everything you need after your appointment.",
    price: "$18",
    bg: "bg-[#c4907a]/8",
    illustration: LashKitIllustration,
  },
  {
    name: "T Creative Lash Cleanser",
    desc: "Private label foam cleanser, 60ml. Gentle on extensions, formulated to protect the bond.",
    price: "$14",
    bg: "bg-[#4e6b51]/8",
    illustration: CleanserIllustration,
  },
  {
    name: "Permanent Jewelry",
    desc: "14k gold-filled chains welded on-site. Bracelets, anklets, necklaces. From $55.",
    price: "From $55",
    bg: "bg-[#d4a574]/8",
    illustration: JewelryIllustration,
  },
  {
    name: "Custom 3D-Printed Accessory",
    desc: "Design-forward 3D-printed accessories. Upload your idea or choose from our collection.",
    price: "From $35",
    bg: "bg-[#7BA3A3]/8",
    illustration: PrintedAccessoryIllustration,
  },
  {
    name: "T Creative Tote Bag",
    desc: "Heavy canvas tote with TC logo. Limited run — only a few left.",
    price: "$28",
    bg: "bg-foreground/[0.03]",
    illustration: ToteBagIllustration,
  },
];

type ProductItem = {
  name: string;
  desc: string;
  price: string;
  bg?: string;
  illustration?: React.ComponentType;
};

export function FeaturedProducts({ products }: { products?: ProductItem[] }) {
  const display =
    products && products.length > 0
      ? products.map((p, i) => ({
          bg: FEATURED[i % FEATURED.length]?.bg ?? "bg-foreground/[0.03]",
          illustration: FEATURED[i % FEATURED.length]?.illustration,
          ...p,
        }))
      : FEATURED;

  return (
    <SectionWrapper id="shop" className="py-32 md:py-48 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 md:mb-20 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
              Shop
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light tracking-tight text-foreground">
              Take the studio with you.
            </h2>
            <p className="mt-3 text-sm text-muted max-w-md leading-relaxed">
              Aftercare essentials, permanent jewelry, 3D-printed pieces, and studio merch.
            </p>
          </div>
          <Link
            href="/shop"
            className="text-[10px] tracking-[0.25em] uppercase text-accent hover:text-foreground transition-colors duration-300 flex items-center gap-3 shrink-0 group"
            data-cursor="link"
          >
            View All Products
            <span className="w-6 h-px bg-current block transition-all duration-300 group-hover:w-10" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {display.map((product) => {
            const Illustration = product.illustration;
            return (
              <Link
                key={product.name}
                href="/shop"
                data-cursor="link"
                className={`group flex flex-col border border-foreground/8 hover:border-foreground/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(44,36,32,0.1)]`}
              >
                {/* Illustration area */}
                <div
                  className={`w-full aspect-square ${product.bg} flex items-center justify-center p-4 overflow-hidden`}
                >
                  {Illustration ? (
                    <Illustration />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-foreground/10" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <h3 className="text-xs font-medium text-foreground leading-snug">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-muted leading-relaxed flex-1 hidden sm:block">
                    {product.desc}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-auto">
                    <span className="text-xs font-medium text-accent">{product.price}</span>
                    <span className="text-[10px] tracking-widest uppercase text-muted group-hover:text-foreground transition-colors">
                      Shop →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
