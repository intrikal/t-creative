/**
 * Training — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { getPublishedPrograms } from "./actions";
import { TrainingPage } from "./TrainingPage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
  description:
    "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  alternates: {
    canonical: "/training",
  },
  openGraph: {
    title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
    description:
      "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
    description:
      "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  },
};

export default async function Page() {
  const programs = await getPublishedPrograms();
  return <TrainingPage programs={programs} />;
}
